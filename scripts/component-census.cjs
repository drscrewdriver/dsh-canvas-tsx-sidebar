#!/usr/bin/env node
/**
 * Independent component census.
 *
 * Counts every capitalised JSX tag in each file — no hardcoded component list,
 * and cross-line aware (a naive line-based grep misses `<Table` when the tag
 * name is followed by a newline, which is how an earlier count went wrong).
 *
 * This is the tool that produces the numbers the tests assert against, so the
 * assertions are derived from the SOURCE rather than from the parser's own
 * output.
 *
 *   node scripts/component-census.cjs tests/fixtures/*.canvas.tsx
 */
const fs = require('node:fs')

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/component-census.cjs <file...>')
  process.exit(2)
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const counts = new Map()
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9]*)(?=[\s/>])/g)) {
    const tag = m[1]
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  console.log(`${file}`)
  console.log(`  components: ${counts.size} distinct, ${total} total`)
  for (const [tag, n] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`    ${tag.padEnd(16)} ${n}`)
  }
  // Native (lowercase) tags, for completeness.
  const native = new Map()
  for (const m of src.matchAll(/<([a-z][a-z0-9-]*)(?=[\s/>])/g)) {
    native.set(m[1], (native.get(m[1]) ?? 0) + 1)
  }
  if (native.size > 0) {
    console.log(`  native tags: ${[...native].map(([t, n]) => `${t}×${n}`).join(', ')}`)
  }
  console.log('')
}
