/**
 * Manifest guards (checklist A1–A3, A9–A10).
 *
 * These encode the market/loader constraints so a later edit cannot silently
 * re-introduce them:
 * - the bare package name `cordis` is hard-rejected by the market gate
 *   (`@deepseek-ai/cordis` is fine — it merely contains the substring);
 * - install-lifecycle scripts are forbidden;
 * - `dsh-better-sidebar` must be an OPTIONAL peer so the plugin loads on
 *   profiles that do not have it;
 * - `exports` and `dsh.bundle.patch` must resolve to real files.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

interface Manifest {
  name: string
  main: string
  exports: Record<string, unknown>
  dsh?: { bundle?: { patch?: string }, client?: { platform?: string } }
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Manifest

describe('package.json — market constraints', () => {
  it('declares no bare `cordis` dependency in any dependency field', () => {
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      const table = pkg[field] ?? {}
      // Exact key match: `@deepseek-ai/cordis` is allowed and must not trip this.
      expect(Object.keys(table), `${field} must not contain the bare name "cordis"`).not.toContain('cordis')
    }
  })

  it('declares no install-lifecycle scripts', () => {
    const forbidden = ['preinstall', 'install', 'postinstall', 'prepare']
    for (const hook of forbidden) {
      expect(pkg.scripts?.[hook], `scripts.${hook} is forbidden`).toBeUndefined()
    }
  })
})

describe('package.json — loader + soft dependency', () => {
  it('exposes dsh-better-sidebar as an OPTIONAL peer', () => {
    expect(pkg.peerDependencies?.['dsh-better-sidebar']).toBeDefined()
    expect(pkg.peerDependenciesMeta?.['dsh-better-sidebar']?.optional).toBe(true)
  })

  it('does not list dsh-better-sidebar as a hard dependency', () => {
    expect(pkg.dependencies?.['dsh-better-sidebar']).toBeUndefined()
    expect(pkg.optionalDependencies?.['dsh-better-sidebar']).toBeUndefined()
  })

  it('declares the two loader entry points', () => {
    expect(pkg.main).toBe('lib/index.mjs')
    expect(pkg.exports['.']).toBeDefined()
    expect(pkg.exports['./client']).toBeDefined()
  })

  it('points dsh.bundle.patch at a file that exists', () => {
    const patch = pkg.dsh?.bundle?.patch
    expect(patch).toBe('./cordis.patch.yml')
    expect(existsSync(resolve(root, patch as string))).toBe(true)
  })

  it('declares the web platform for the client half', () => {
    expect(pkg.dsh?.client?.platform).toBe('web')
  })
})

describe('package.json — no heavy parser runtime dependency', () => {
  it('keeps the runtime dependency set free of parsers (self-built parser, spec §2.5)', () => {
    const deps = Object.keys(pkg.dependencies ?? {})
    for (const forbidden of ['typescript', '@babel/parser', '@babel/core', 'sucrase', 'esbuild']) {
      expect(deps, `${forbidden} must not be a runtime dependency`).not.toContain(forbidden)
    }
  })
})
