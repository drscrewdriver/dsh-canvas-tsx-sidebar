#!/usr/bin/env node
/**
 * Client-bundle audit (checklist A8, B12, B13).
 *
 * The vitest guards scan `src/**` as text; this script checks the REAL build
 * output instead, which is what the browser module loader actually executes.
 * Run it after `pnpm build`:
 *
 *   node scripts/audit-bundle.cjs lib/client.js
 *
 * Why it is not a vitest spec: the bundle only exists after a build, and CI
 * should not silently pass a bundle check against a stale or absent artifact.
 */
const fs = require('node:fs')

const target = process.argv[2] ?? 'lib/client.js'
if (!fs.existsSync(target)) {
  console.error(`audit-bundle: not found: ${target} (run \`pnpm build\` first)`)
  process.exit(2)
}

const b = fs.readFileSync(target, 'utf8')

/** [label, forbidden-pattern] — every entry must NOT match. */
const forbidden = [
  ['node: builtin leak', /require\(["'`]node:/],
  ['bare builtin leak (fs/path/os/child_process/vm)', /require\(["'`](fs|path|os|child_process|vm)["'`]\)/],
  ['typescript in bundle', /\btypescript\b/i],
  ['@babel in bundle', /@babel/],
  ['sucrase in bundle', /sucrase/],
  ['code execution: eval(', /\beval\s*\(/],
  ['code execution: new Function(', /new\s+Function\s*\(/],
  ['file viewer registration', /registerFileViewer/],
  ['file icon registration', /registerFileIcon/],
]

/** [label, required-pattern] — every entry MUST match. */
const required = [
  ['tab registration', /registerTab/],
  ['locale dictionary registration', /\.register\(/],
  ['loader id matches package name', /id:\s*"dsh-canvas-tsx-sidebar"/],
  ['ctx.effect labels present', /dsh-canvas-tsx-sidebar: (tab|dictionary)/],
  ['module-loader envelope', /window\.__ModuleLoader__\.load\(/],
]

let failed = 0
console.log(`audit-bundle: ${target} (${b.length} B)\n`)

for (const [label, re] of forbidden) {
  const hit = re.test(b)
  if (hit) failed++
  console.log(`  ${hit ? 'FAIL' : 'PASS'}  must-not-match  ${label}`)
}
for (const [label, re] of required) {
  const ok = re.test(b)
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  must-match      ${label}`)
}

console.log(`\n${failed === 0 ? 'OK — bundle clean' : `${failed} check(s) failed`}`)
process.exit(failed === 0 ? 0 : 1)
