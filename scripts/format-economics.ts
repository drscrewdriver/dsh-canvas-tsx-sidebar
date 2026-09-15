#!/usr/bin/env node
/**
 * Format economics: is `.canvas.tsx` actually a byte-efficient encoding?
 *
 *   npx tsx scripts/format-economics.ts <dir-or-file...>
 *
 * All projections are built from the SAME parsed IR, so the content is held
 * constant and only the encoding differs. Raw bytes are reported, but the
 * number that matters for a wire/prose format is the gzip size.
 *
 * Definitions:
 *   - source bytes : the .canvas.tsx file on disk (UTF-8)
 *   - prose bytes  : sum of every `text` node's UTF-8 length — the content a
 *                    human actually reads
 *   - IR           : JSON serialisation of the parsed tree (a compile-once
 *                    pipeline could ship this instead of source)
 *   - HTML / MD    : minimal projections of the same tree
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { extractCanvas } from '../src/client/canvas/extract.ts'
import type { CanvasNode, CanvasProp } from '../src/client/canvas/ir.ts'

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
    for (const name of readdirSync(p)) if (name.endsWith('.canvas.tsx')) out.push(join(p, name))
  }
  return out.sort()
}

const bytes = (s: string): number => Buffer.byteLength(s, 'utf8')
const gz = (s: string): number => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Minimal HTML projection of the IR. */
function toHtml(node: CanvasNode): string {
  if (node.kind === 'text') return esc(node.value)
  if (node.kind === 'unsupported') return `<span data-unresolved>${esc(node.snippet ?? '')}</span>`
  const isNative = node.tag !== '' && node.tag[0] === node.tag[0]?.toLowerCase()
  const tag = node.tag === '' ? 'div' : isNative ? node.tag : 'div'
  const attrs = Object.entries(node.props)
    .map(([k, v]) => ` ${k}="${esc(JSON.stringify(v)).replace(/"/g, '&quot;')}"`)
    .join('')
  return `<${tag}${attrs}>${node.children.map(toHtml).join('')}</${tag}>`
}

/** Markdown projection: content plus light structural hints. */
function toMarkdown(node: CanvasNode): string {
  if (node.kind === 'text') return node.value
  if (node.kind === 'unsupported') return '<!-- unresolved -->'
  const inner = node.children.map(toMarkdown).join('')
  switch (node.tag) {
    case 'H1':
      return `# ${inner}\n\n`
    case 'H2':
      return `## ${inner}\n\n`
    case 'H3':
      return `### ${inner}\n\n`
    case 'Divider':
      return `---\n\n`
    case 'Table': {
      const headers = (node.props.headers as string[] | undefined) ?? []
      const rows = (node.props.rows as CanvasProp[][] | undefined) ?? []
      const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`
      const body = rows.map(r => `| ${r.map(c => String(c)).join(' | ')} |`).join('\n')
      return `${head}${body}\n\n`
    }
    case 'Callout':
      return `> **${String(node.props.title ?? '')}** ${inner}\n\n`
    default:
      return inner
  }
}

interface Row {
  name: string
  source: number
  prose: number
  nodes: number
  props: number
}

const rows: Row[] = []
const sourceTexts: string[] = []
const irTexts: string[] = []
const htmlTexts: string[] = []
const mdTexts: string[] = []

for (const file of collect(process.argv.slice(2))) {
  const display = (file.split(/[\\/]/).pop() ?? file).split('__').pop() as string
  const src = readFileSync(file, 'utf8')
  const result = extractCanvas(src)
  if (!result.ok) continue

  let prose = 0
  let nodes = 0
  let props = 0
  const visit = (n: CanvasNode): void => {
    nodes++
    if (n.kind === 'text') {
      prose += bytes(n.value)
      return
    }
    if (n.kind !== 'element') return
    props += Object.keys(n.props).length
    n.children.forEach(visit)
  }
  visit(result.root)

  const irStr = JSON.stringify(result.root)
  sourceTexts.push(src)
  irTexts.push(irStr)
  htmlTexts.push(toHtml(result.root))
  mdTexts.push(toMarkdown(result.root))
  rows.push({ name: display, source: bytes(src), prose, nodes, props })
}

if (rows.length === 0) {
  console.error('no parsable canvas files found')
  process.exit(2)
}

const sum = (f: (r: Row) => number): number => rows.reduce((a, r) => a + f(r), 0)
const totalSource = sum(r => r.source)
const totalProse = sum(r => r.prose)
const totalNodes = sum(r => r.nodes)
const totalProps = sum(r => r.props)

const joinAll = (a: string[]): string => a.join('\n')
const rawIr = bytes(joinAll(irTexts))
const rawHtml = bytes(joinAll(htmlTexts))
const rawMd = bytes(joinAll(mdTexts))
const gzSource = gz(joinAll(sourceTexts))
const gzIr = gz(joinAll(irTexts))
const gzHtml = gz(joinAll(htmlTexts))
const gzMd = gz(joinAll(mdTexts))

console.log(`files: ${rows.length}   nodes: ${totalNodes}   props: ${totalProps}\n`)

console.log('--- raw bytes ---')
console.log(`  source .canvas.tsx  ${totalSource.toLocaleString().padStart(9)} B`)
console.log(`  prose (text nodes)  ${totalProse.toLocaleString().padStart(9)} B   ${((totalProse / totalSource) * 100).toFixed(1)}% of source`)
console.log(`  IR as JSON          ${rawIr.toLocaleString().padStart(9)} B   ${(rawIr / totalSource).toFixed(2)}x source`)
console.log(`  HTML projection     ${rawHtml.toLocaleString().padStart(9)} B   ${(rawHtml / totalSource).toFixed(2)}x source`)
console.log(`  Markdown projection ${rawMd.toLocaleString().padStart(9)} B   ${(rawMd / totalSource).toFixed(2)}x source`)

console.log('\n--- gzip -9 (the number that matters for a wire/prose format) ---')
const row2 = (label: string, raw: number, g: number): void => {
  console.log(
    `  ${label.padEnd(20)} ${g.toLocaleString().padStart(7)} B gz  ${((g / raw) * 100).toFixed(1)}% of raw  ${(g / gzSource).toFixed(2)}x source-gz`,
  )
}
row2('source .canvas.tsx', totalSource, gzSource)
row2('IR as JSON', rawIr, gzIr)
row2('HTML projection', rawHtml, gzHtml)
row2('Markdown projection', rawMd, gzMd)

const delta = totalSource - rawIr
const cmp = (d: number, base: number): string =>
  `source is ${Math.abs((d / base) * 100).toFixed(1)}% ${d > 0 ? 'LARGER' : 'smaller'} (${d > 0 ? '+' : ''}${d.toLocaleString()} B)`
console.log(`\n--- source vs JSON IR (same tree, different encoding) ---`)
console.log(`  raw     : ${cmp(delta, rawIr)}`)
const gzDelta = gzSource - gzIr
console.log(`  gzipped : ${cmp(gzDelta, gzIr)}`)

const mdDelta = gzSource - gzMd
console.log(`\n--- source vs Markdown projection ---`)
console.log(`  raw     : ${cmp(totalSource - rawMd, rawMd)}`)
console.log(`  gzipped : ${(gzSource / gzMd).toFixed(2)}x Markdown (${cmp(mdDelta, gzMd)})`)

console.log(`\n--- density ---`)
console.log(`  bytes per node      : ${(totalSource / totalNodes).toFixed(1)} raw / ${(gzSource / totalNodes).toFixed(1)} gz`)
console.log(`  bytes per prop      : ${(totalSource / totalProps).toFixed(1)} raw / ${(gzSource / totalProps).toFixed(1)} gz`)
console.log(
  `  structure overhead  : ${(((totalSource - totalProse) / totalSource) * 100).toFixed(1)}% of the raw file is NOT prose`,
)
console.log(
  `  prose is            : ${((totalProse / totalSource) * 100).toFixed(1)}% of raw, ${((totalProse / gzSource) * 100).toFixed(0)}% of the gzipped size`,
)
console.log(
  `  → gzip absorbs the structural redundancy; what remains is mostly prose`,
)

console.log(`\n--- per-file structure/prose ratio (top 3 and bottom 3) ---`)
const byRatio = [...rows].sort((a, b) => b.source / b.prose - a.source / a.prose)
for (const r of [...byRatio.slice(0, 3), ...byRatio.slice(-3)]) {
  console.log(
    `  ${(r.source / r.prose).toFixed(1).padStart(5)}x  ${String(r.source).padStart(5)}B src  ${String(r.prose).padStart(5)}B prose  ${r.name}`,
  )
}
