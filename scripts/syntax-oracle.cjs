/**
 * Syntax oracle: parse a .canvas.tsx with the REAL TypeScript compiler.
 *
 * `typescript` is a devDependency only — it never ships in the bundle. It is
 * used here purely to establish ground truth about what the source file
 * actually is, so the hand-rolled parser can be judged against a compiler
 * rather than against our own assumptions.
 *
 *   node scripts/syntax-oracle.cjs tests/fixtures/sample.canvas.tsx
 */
const fs = require('node:fs')
const ts = require('typescript')

const path = process.argv[2]
if (path === undefined) {
  console.error('usage: node scripts/syntax-oracle.cjs <file.canvas.tsx>')
  process.exit(2)
}

const src = fs.readFileSync(path, 'utf8')
const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const diags = sf.parseDiagnostics ?? []
console.log(`file: ${path}`)
// Report both: `src.length` is UTF-16 code units (CJK counts as 1), while
// `Buffer.byteLength` is the on-disk size (CJK is 3 bytes in UTF-8). Labelling
// the JS length "bytes" understates the file for CJK content.
console.log(`chars (UTF-16 code units): ${src.length}`)
console.log(`bytes (UTF-8 on disk): ${Buffer.byteLength(src, 'utf8')}`)
console.log(`TS parse diagnostics: ${diags.length}`)

for (const d of diags) {
  const pos = sf.getLineAndCharacterOfPosition(d.start ?? 0)
  const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ')
  console.log(`  ${pos.line + 1}:${pos.character + 1}  TS${d.code}  ${msg}`)
  // Show the offending source line for context.
  const line = src.split(/\r\n|\n|\r/)[pos.line]
  if (line !== undefined) console.log(`      | ${line.trim()}`)
}

// Report the top-level declaration shape so we can confirm the default export.
const top = sf.statements.map(s => ts.SyntaxKind[s.kind])
console.log(`top-level statements: ${top.join(', ')}`)

process.exit(diags.length === 0 ? 0 : 1)
