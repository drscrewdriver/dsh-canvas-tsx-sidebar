#!/usr/bin/env node
/**
 * Corpus statistics: find the long tail.
 *
 *   npx tsx scripts/corpus-stats.ts <dir-or-file...>
 *
 * Reports size distribution, component frequency (with rarity), and the
 * outlier files at both ends — the ones worth turning into fixtures.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { extractCanvas } from '../src/client/canvas/extract.ts'
import type { CanvasNode } from '../src/client/canvas/ir.ts'

function collect(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths) {
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isFile()) {
      out.push(p)
      continue
    }
    for (const name of readdirSync(p)) {
      if (name.endsWith('.canvas.tsx')) out.push(join(p, name))
    }
  }
  return out.sort()
}

interface Row {
  name: string
  bytes: number
  lines: number
  nodes: number
  components: number
  unsupported: number
  unresolved: number
  tags: string[]
}

function measure(file: string): Row | null {
  const display = (file.split(/[\\/]/).pop() ?? file).split('__').pop() as string
  const src = readFileSync(file, 'utf8')
  const result = extractCanvas(src)
  if (!result.ok) return null

  let nodes = 0
  let unsupported = 0
  let unresolved = 0
  const tags = new Set<string>()
  const visit = (n: CanvasNode): void => {
    if (n.kind === 'unsupported') {
      unsupported++
      nodes++
      return
    }
    if (n.kind !== 'element') {
      nodes++
      return
    }
    nodes++
    if (n.unresolved !== undefined) unresolved++
    if (n.tag !== '') tags.add(n.tag)
    n.children.forEach(visit)
  }
  visit(result.root)

  return {
    name: display,
    bytes: Buffer.byteLength(src, 'utf8'),
    lines: src.split(/\r\n|\n|\r/).length,
    nodes,
    components: tags.size,
    unsupported,
    unresolved,
    tags: [...tags],
  }
}

const rows = collect(process.argv.slice(2)).map(measure).filter((r): r is Row => r !== null)
if (rows.length === 0) {
  console.error('no parsable canvas files found')
  process.exit(2)
}

const pct = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] as number

function distribution(label: string, values: number[]): void {
  const s = [...values].sort((a, b) => a - b)
  const sum = s.reduce((a, b) => a + b, 0)
  console.log(`${label}`)
  console.log(
    `  min ${s[0]}  p25 ${pct(s, 0.25)}  median ${pct(s, 0.5)}  p75 ${pct(s, 0.75)}  p90 ${pct(s, 0.9)}  max ${s[s.length - 1]}  mean ${(sum / s.length).toFixed(1)}`,
  )
}

console.log(`files: ${rows.length}\n`)
distribution('bytes (UTF-8)', rows.map(r => r.bytes))
distribution('lines', rows.map(r => r.lines))
distribution('IR nodes', rows.map(r => r.nodes))
distribution('distinct components per file', rows.map(r => r.components))

console.log('\n--- outliers: largest by bytes ---')
for (const r of [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
  console.log(`  ${String(r.bytes).padStart(6)}B ${String(r.lines).padStart(4)}L ${String(r.nodes).padStart(4)}N ${r.name}`)
}

console.log('\n--- outliers: smallest by bytes ---')
for (const r of [...rows].sort((a, b) => a.bytes - b.bytes).slice(0, 5)) {
  console.log(`  ${String(r.bytes).padStart(6)}B ${String(r.lines).padStart(4)}L ${String(r.nodes).padStart(4)}N ${r.name}`)
}

console.log('\n--- outliers: most distinct components ---')
for (const r of [...rows].sort((a, b) => b.components - a.components).slice(0, 5)) {
  console.log(`  ${String(r.components).padStart(3)} comps  ${r.name}`)
  console.log(`      ${r.tags.sort().join(' ')}`)
}

// Component frequency across files.
const freq = new Map<string, number>()
for (const r of rows) for (const t of r.tags) freq.set(t, (freq.get(t) ?? 0) + 1)
const sorted = [...freq].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

console.log('\n--- component frequency (files using it) ---')
for (const [tag, n] of sorted) {
  const bar = '#'.repeat(Math.max(1, Math.round((n / rows.length) * 30)))
  console.log(`  ${tag.padEnd(18)} ${String(n).padStart(3)}  ${bar}`)
}

const rare = sorted.filter(([, n]) => n === 1)
console.log(`\nlong tail: ${rare.length} of ${sorted.length} components appear in exactly ONE file`)
for (const [tag] of rare) console.log(`  ${tag}`)

// Concentration measured over component INSTANCES, not files: "what share of
// every element ever rendered does the top-k vocabulary account for?".
const instances = new Map<string, number>()
for (const r of rows) {
  const src = readFileSync(collect(process.argv.slice(2))[rows.indexOf(r)] as string, 'utf8')
  const result = extractCanvas(src)
  if (!result.ok) continue
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    if (n.tag !== '') instances.set(n.tag, (instances.get(n.tag) ?? 0) + 1)
    n.children.forEach(visit)
  }
  visit(result.root)
}
const instSorted = [...instances].sort((a, b) => b[1] - a[1])
const totalInstances = instSorted.reduce((a, [, n]) => a + n, 0)

console.log(`\n--- vocabulary concentration over ${totalInstances} component instances ---`)
for (const k of [3, 5, 8, 12, 16, instSorted.length]) {
  if (k > instSorted.length) continue
  const covered = instSorted.slice(0, k).reduce((a, [, n]) => a + n, 0)
  console.log(
    `  top ${String(k).padStart(2)} of ${instSorted.length} -> ${((covered / totalInstances) * 100).toFixed(1)}% of all instances`,
  )
}

// Shannon entropy of the component distribution, in bits per instance, plus
// the theoretical minimum bits per instance if the vocabulary were uniform.
const entropy = -instSorted.reduce((a, [, n]) => {
  const p = n / totalInstances
  return a + p * Math.log2(p)
}, 0)
const uniform = Math.log2(instSorted.length)
console.log(
  `\nShannon entropy of component choice: ${entropy.toFixed(2)} bits/instance (uniform over ${instSorted.length} would be ${uniform.toFixed(2)})`,
)
console.log(`  → redundancy vs uniform: ${(((uniform - entropy) / uniform) * 100).toFixed(1)}%`)
