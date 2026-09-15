#!/usr/bin/env node
/**
 * Corpus audit: run the syntax oracle AND the parser over every canvas file in
 * a directory, and report a per-file matrix.
 *
 *   npx tsx scripts/audit-corpus.ts <dir-or-file...>
 *
 * For each file it reports:
 *   - TS   : parse diagnostics from the real TypeScript compiler (0 = valid TSX)
 *   - IR   : whether extractCanvas() succeeded
 *   - uns  : number of `unsupported` nodes the parser had to degrade
 *   - unr  : number of elements carrying `unresolved` props
 *   - tags : distinct component tags seen
 *
 * `typescript` is a devDependency; it never reaches the client bundle.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import tsTypeScript from 'typescript'
import { extractCanvas } from '../src/client/canvas/extract.ts'
import type { CanvasNode } from '../src/client/canvas/ir.ts'

/** Collect `.canvas.tsx` files from the given paths (files or directories). */
function collect(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths) {
    let st
    try {
      st = statSync(p)
    } catch {
      console.error(`skip (not found): ${p}`)
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

/** Real-compiler diagnostic count for a TSX source. */
function tsDiagnostics(name: string, src: string): number {
  const sf = tsTypeScript.createSourceFile(
    name,
    src,
    tsTypeScript.ScriptTarget.Latest,
    true,
    tsTypeScript.ScriptKind.TSX,
  )
  return (sf.parseDiagnostics ?? []).length
}

interface Stats {
  unsupported: number
  unresolved: number
  tags: Set<string>
}

function stats(root: CanvasNode): Stats {
  const out: Stats = { unsupported: 0, unresolved: 0, tags: new Set() }
  const visit = (n: CanvasNode): void => {
    if (n.kind === 'unsupported') {
      out.unsupported++
      return
    }
    if (n.kind !== 'element') return
    if (n.unresolved !== undefined) out.unresolved++
    if (n.tag !== '') out.tags.add(n.tag)
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

const files = collect(process.argv.slice(2))
if (files.length === 0) {
  console.error('usage: npx tsx scripts/audit-corpus.ts <dir-or-file...>')
  process.exit(2)
}

let invalidTs = 0
let parseFailed = 0
let withUnsupported = 0
let withUnresolved = 0
let totalUnsupported = 0
let totalUnresolved = 0
const allTags = new Map<string, number>()

console.log('file'.padEnd(52) + 'TS  IR    unsNodes unrElems  tags')
console.log('-'.repeat(96))

for (const file of files) {
  const short = file.split(/[\\/]/).pop() ?? file
  // Cache filenames are `<uuid>__<original>`; show only the original part.
  const display = short.includes('__') ? (short.split('__').pop() as string) : short
  const src = readFileSync(file, 'utf8')

  let diags = -1
  try {
    diags = tsDiagnostics(display, src)
  } catch {
    diags = -2
  }
  if (diags !== 0) invalidTs++

  const result = extractCanvas(src)
  if (!result.ok) {
    parseFailed++
    console.log(
      `${display.slice(0, 50).padEnd(52)}${String(diags).padStart(2)}  FAIL:${result.error.code}`,
    )
    continue
  }

  const s = stats(result.root)
  if (s.unsupported > 0) withUnsupported++
  if (s.unresolved > 0) withUnresolved++
  totalUnsupported += s.unsupported
  totalUnresolved += s.unresolved
  for (const tag of s.tags) allTags.set(tag, (allTags.get(tag) ?? 0) + 1)

  console.log(
    `${display.slice(0, 50).padEnd(52)}${String(diags).padStart(2)}  ok ${String(s.unsupported).padStart(8)}${String(s.unresolved).padStart(9)}  ${s.tags.size}`,
  )
}

console.log('-'.repeat(96))
console.log(`files: ${files.length}`)
console.log(`  TS diagnostics > 0 : ${invalidTs}`)
console.log(`  parse failed       : ${parseFailed}`)
console.log(`  had unsupported    : ${withUnsupported}   (total nodes: ${totalUnsupported})`)
console.log(`  had unresolved     : ${withUnresolved}   (total props: ${totalUnresolved})`)
console.log('')
console.log('component coverage across the corpus (files using it):')
for (const [tag, n] of [...allTags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${tag.padEnd(20)} ${n}`)
}
console.log(`  → ${allTags.size} distinct components`)
