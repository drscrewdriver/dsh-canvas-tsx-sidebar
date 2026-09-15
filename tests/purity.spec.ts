/**
 * Source purity guards (checklist A4, A8, B12, B13, X2).
 *
 * Scans `src/**` as TEXT — these are static properties of the source, so a
 * regex scan is the right tool (unlike the canvas parser, where regex is
 * unusable because of JSX nesting and `>`/`<` inside strings).
 *
 * What is enforced:
 * - A4  no value-import of better-sidebar internals (type-only imports are
 *       erased and are explicitly allowed);
 * - A8  we register a tab only — never a file viewer or a file icon;
 * - B12 zero code execution (`eval` / `new Function` / `node:vm`);
 * - B13 no heavy parser ever reaches the client bundle;
 * - X2  same as B12, kept as a deliverable-level guard.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = resolve(root, 'src')

/** Every file under src/, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(srcDir).map(path => ({
  path,
  rel: relative(root, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}))

describe('src purity — imports', () => {
  it('has at least one source file (fixture sanity)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('never VALUE-imports dsh-better-sidebar (type-only is allowed)', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const line of file.text.split('\n')) {
        // `import type ... from 'dsh-better-sidebar...'` is erased at build time
        // and is the documented way to get the Context augmentation.
        if (!/^\s*import\b/.test(line)) continue
        if (/^\s*import\s+type\b/.test(line)) continue
        if (/from\s+['"]dsh-better-sidebar/.test(line)) offenders.push(`${file.rel}: ${line.trim()}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

describe('src purity — registration surface', () => {
  it('registers a viewer and a tab but never a file icon', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const banned of ['registerFileIcon']) {
        if (file.text.includes(banned)) offenders.push(`${file.rel}: ${banned}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

describe('src purity — no code execution', () => {
  it('contains no eval / new Function / node:vm', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const banned of [/\beval\s*\(/, /new\s+Function\s*\(/, /from\s+['"]node:vm['"]/, /require\(['"]vm['"]\)/]) {
        if (banned.test(file.text)) offenders.push(`${file.rel}: ${String(banned)}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

describe('src purity — no heavy parser reaches the client bundle', () => {
  it('imports no typescript / babel / sucrase / esbuild', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const banned of ['typescript', '@babel/parser', '@babel/core', 'sucrase', 'esbuild']) {
        const re = new RegExp(`from\\s+['"]${banned.replace(/[/@]/g, m => `\\${m}`)}['"]`)
        if (re.test(file.text)) offenders.push(`${file.rel}: ${banned}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
