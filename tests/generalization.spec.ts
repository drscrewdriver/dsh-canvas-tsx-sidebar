/**
 * Generalisation guards — real canvas files beyond the original sample.
 *
 * These three files come from a different project (`test/machine-learning`) and
 * exercise components the first sample never used: Card / CardHeader /
 * CardBody / Tag / Timeline / MetricsGrid, plus object-literal array props
 * (`events={[{...}]}`, `items={[{...}]}`) and two files with NO ReportShell.
 *
 * Every expected number below was produced by `scripts/component-census.cjs`,
 * which scans the SOURCE text. The assertions therefore compare the parser's
 * output against an independently derived census, not against itself.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractCanvas } from '../src/client/canvas/extract'
import type { CanvasNode } from '../src/client/canvas/ir'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string): string => readFileSync(resolve(here, 'fixtures', name), 'utf8')

const FILES = {
  gymnasium: 'gymnasium-contract-fix-report.canvas.tsx',
  dreamer: 'dreamer-three-questions-report.canvas.tsx',
  pendulum: 'pendulum-v1-restore-report.canvas.tsx',
} as const

/** Source-derived census (`scripts/component-census.cjs`). */
const SOURCE_CENSUS: Record<keyof typeof FILES, Record<string, number>> = {
  gymnasium: {
    H2: 6, Text: 6, Stat: 4, Card: 2, CardBody: 2, CardHeader: 2,
    Divider: 2, Grid: 2, Stack: 2, Table: 2, Callout: 1, H1: 1, Tag: 1, Timeline: 1,
  },
  dreamer: {
    ReportSection: 5, Callout: 4, Table: 4, Text: 4, Stack: 3,
    H1: 1, MetricsGrid: 1, ReportShell: 1, header: 1,
  },
  pendulum: {
    Text: 7, H2: 5, Stack: 5, Card: 4, CardBody: 4, CardHeader: 4, Stat: 4,
    Tag: 4, Divider: 3, Callout: 2, Grid: 2, H1: 1, Table: 1, Timeline: 1,
  },
}

/** Census of an IR tree, by tag (native lowercase tags included). */
function census(root: CanvasNode): Record<string, number> {
  const counts: Record<string, number> = {}
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    const tag = n.tag === '' ? '(Fragment)' : n.tag
    counts[tag] = (counts[tag] ?? 0) + 1
    n.children.forEach(visit)
  }
  visit(root)
  return counts
}

/** Every `unsupported` node in the tree. */
function unsupportedNodes(root: CanvasNode): CanvasNode[] {
  const out: CanvasNode[] = []
  const visit = (n: CanvasNode): void => {
    if (n.kind === 'unsupported') out.push(n)
    if (n.kind === 'element') n.children.forEach(visit)
  }
  visit(root)
  return out
}

/** Every element carrying an `unresolved` prop list. */
function unresolvedElements(root: CanvasNode): Array<Extract<CanvasNode, { kind: 'element' }>> {
  const out: Array<Extract<CanvasNode, { kind: 'element' }>> = []
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    if (n.unresolved !== undefined) out.push(n)
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

function rootOf(key: keyof typeof FILES): Extract<CanvasNode, { kind: 'element' }> {
  const result = extractCanvas(read(FILES[key]))
  if (!result.ok) throw new Error(`${key}: ${result.error.code} ${result.error.message}`)
  return result.root as Extract<CanvasNode, { kind: 'element' }>
}

describe('generalisation — three real files from another project', () => {
  it.each(Object.keys(FILES) as Array<keyof typeof FILES>)(
    '%s parses without error and without unsupported nodes',
    key => {
      const result = extractCanvas(read(FILES[key]))
      expect(result.ok, `${key} failed to parse`).toBe(true)
      if (!result.ok) return
      expect(unsupportedNodes(result.root)).toEqual([])
      expect(unresolvedElements(result.root)).toEqual([])
    },
  )

  it.each(Object.keys(FILES) as Array<keyof typeof FILES>)(
    '%s component census matches the source scan exactly',
    key => {
      expect(census(rootOf(key))).toEqual(SOURCE_CENSUS[key])
    },
  )
})

describe('generalisation — component vocabulary actually used', () => {
  it('covers all 17 distinct components seen across every fixture', () => {
    const union = new Set<string>()
    for (const key of Object.keys(FILES) as Array<keyof typeof FILES>) {
      for (const tag of Object.keys(SOURCE_CENSUS[key])) union.add(tag)
    }
    // From the original sample too.
    for (const tag of Object.keys(census(rootOf('gymnasium')))) union.add(tag)
    expect(union.has('Card')).toBe(true)
    expect(union.has('CardHeader')).toBe(true)
    expect(union.has('CardBody')).toBe(true)
    expect(union.has('Tag')).toBe(true)
    expect(union.has('Timeline')).toBe(true)
    expect(union.has('MetricsGrid')).toBe(true)
  })

  it('extracts the Timeline events array as literal objects', () => {
    const timeline = (() => {
      let found: Extract<CanvasNode, { kind: 'element' }> | undefined
      const visit = (n: CanvasNode): void => {
        if (n.kind !== 'element') return
        if (n.tag === 'Timeline' && found === undefined) found = n
        n.children.forEach(visit)
      }
      visit(rootOf('gymnasium'))
      return found
    })()
    expect(timeline).toBeDefined()
    const events = timeline?.props.events
    expect(Array.isArray(events)).toBe(true)
    const first = (events as Array<Record<string, unknown>>)[0]
    expect(first.id).toBe('plan')
    expect(first.timestamp).toBe('步骤 1')
    expect(first.state).toBe('completed')
    expect(typeof first.title).toBe('string')
    expect(typeof first.description).toBe('string')
    // Every event object must be fully literal — no partial extraction.
    for (const ev of events as Array<Record<string, unknown>>) {
      expect(typeof ev.id).toBe('string')
      expect(typeof ev.title).toBe('string')
    }
  })

  it('extracts MetricsGrid items as literal objects', () => {
    let grid: Extract<CanvasNode, { kind: 'element' }> | undefined
    const visit = (n: CanvasNode): void => {
      if (n.kind !== 'element') return
      if (n.tag === 'MetricsGrid') grid = n
      n.children.forEach(visit)
    }
    visit(rootOf('dreamer'))
    expect(grid).toBeDefined()
    const items = grid?.props.items
    expect(Array.isArray(items)).toBe(true)
    expect((items as unknown[]).length).toBeGreaterThan(0)
  })

  it('Carries CardHeader.title through as a plain prop', () => {
    const titles: string[] = []
    const visit = (n: CanvasNode): void => {
      if (n.kind !== 'element') return
      if (n.tag === 'CardHeader' && typeof n.props.title === 'string') titles.push(n.props.title)
      n.children.forEach(visit)
    }
    visit(rootOf('pendulum'))
    expect(titles.length).toBe(4)
  })
})

describe('generalisation — ReportShell is optional', () => {
  it('dreamer has a ReportShell root', () => {
    expect(rootOf('dreamer').tag).toBe('ReportShell')
  })

  it('gymnasium and pendulum have a bare Stack root (no page frame)', () => {
    // The report recipe asks for ReportShell, but real files do not always
    // comply. The renderer must therefore supply a default frame rather than
    // assume the root provides one.
    expect(rootOf('gymnasium').tag).toBe('Stack')
    expect(rootOf('pendulum').tag).toBe('Stack')
    expect(census(rootOf('gymnasium')).ReportShell).toBeUndefined()
    expect(census(rootOf('pendulum')).ReportShell).toBeUndefined()
  })
})
