#!/usr/bin/env node
/**
 * Dump the IR for a canvas file, for human review and golden-fixture refresh.
 *
 *   npx tsx scripts/dump-ir.ts tests/fixtures/sample.canvas.tsx
 *
 * The golden fixture (`tests/fixtures/sample.ir.json`) must be HAND-VERIFIED
 * after regeneration — never trusted just because this script produced it.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { extractCanvas } from '../src/client/canvas/extract.ts'
import type { CanvasNode } from '../src/client/canvas/ir.ts'

const path = process.argv[2]
if (path === undefined) {
  console.error('usage: npx tsx scripts/dump-ir.ts <file.canvas.tsx>')
  process.exit(2)
}

const source = readFileSync(path, 'utf8')
const result = extractCanvas(source)

if (!result.ok) {
  console.error('extract failed:', result.error.code, '-', result.error.message)
  process.exit(1)
}

/** Compact one-line summary, so a human can eyeball structure fast. */
function outline(node: CanvasNode, depth = 0): string {
  const pad = '  '.repeat(depth)
  if (node.kind === 'text') return `${pad}"${node.value.length > 60 ? node.value.slice(0, 60) + '…' : node.value}"`
  if (node.kind === 'unsupported') return `${pad}!unsupported(${node.reason})`
  const props = Object.keys(node.props)
  const un = node.unresolved === undefined ? '' : ` UNRESOLVED=[${node.unresolved.join(',')}]`
  const head = `${pad}<${node.tag === '' ? 'Fragment' : node.tag}> props=[${props.join(',')}]${un}`
  return [head, ...node.children.map(c => outline(c, depth + 1))].join('\n')
}

const writeIndex = process.argv.indexOf('--write')
if (writeIndex !== -1) {
  const target = process.argv[writeIndex + 1]
  if (target === undefined) {
    console.error('usage: ... --write <out.json>')
    process.exit(2)
  }
  writeFileSync(target, `${JSON.stringify(result.root, null, 2)}\n`, 'utf8')
  console.log(`wrote ${target}`)
  process.exit(0)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result.root, null, 2))
  process.exit(0)
}

console.log('--- outline ---')
console.log(outline(result.root))
console.log('\n--- stats ---')
const counts: Record<string, number> = {}
const walk = (n: CanvasNode): void => {
  if (n.kind === 'element') {
    const key = n.tag === '' ? 'Fragment' : n.tag
    counts[key] = (counts[key] ?? 0) + 1
    n.children.forEach(walk)
  } else {
    counts[`(${n.kind})`] = (counts[`(${n.kind})`] ?? 0) + 1
  }
}
walk(result.root)
for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`)

if (process.argv.includes('--json')) {
  console.log('\n--- json ---')
  console.log(JSON.stringify(result.root, null, 2))
}
