#!/usr/bin/env node
/**
 * Corpus gap analysis: aggregate WHY the parser degrades across a corpus.
 *
 *   npx tsx scripts/corpus-gaps.ts <dir-or-file...>
 *
 * Prints, in frequency order:
 *   - every distinct `unsupported` reason with one sample snippet;
 *   - every distinct prop name that landed in an element's `unresolved` list.
 *
 * This is the input for deciding which expressions are worth modelling and
 * which are legitimately out of scope.
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

interface Gap {
  count: number
  files: Set<string>
  sample: string
}

const unsupportedGaps = new Map<string, Gap>()
const unresolvedGaps = new Map<string, Gap>()

function note(map: Map<string, Gap>, key: string, file: string, sample: string): void {
  const cur = map.get(key) ?? { count: 0, files: new Set<string>(), sample }
  cur.count++
  cur.files.add(file)
  map.set(key, cur)
}

for (const file of collect(process.argv.slice(2))) {
  const display = (file.split(/[\\/]/).pop() ?? file).split('__').pop() as string
  const result = extractCanvas(readFileSync(file, 'utf8'))
  if (!result.ok) continue

  const visit = (n: CanvasNode): void => {
    if (n.kind === 'unsupported') {
      note(unsupportedGaps, n.reason, display, n.snippet ?? '')
      return
    }
    if (n.kind !== 'element') return
    for (const prop of n.unresolved ?? []) note(unresolvedGaps, prop, display, `<${n.tag}>`)
    n.children.forEach(visit)
  }
  visit(result.root)
}

function report(title: string, map: Map<string, Gap>): void {
  console.log(`\n### ${title}\n`)
  if (map.size === 0) {
    console.log('  (none)')
    return
  }
  const rows = [...map].sort((a, b) => b[1].count - a[1].count)
  for (const [key, gap] of rows) {
    console.log(`  ${key}`)
    console.log(`      hits ${gap.count} across ${gap.files.size} file(s)`)
    console.log(`      e.g. ${gap.sample.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
}

report('unsupported reasons', unsupportedGaps)
report('unresolved prop names', unresolvedGaps)
