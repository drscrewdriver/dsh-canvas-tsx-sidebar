/**
 * Corpus regression guards (checklist B17–B21).
 *
 * Four real canvas files taken from the Qoder `workingSpace` cache, chosen
 * because between them they pin every rule added in the static-resolution
 * extension — and one of them pins the BOUNDARY (forms that must stay
 * unresolved rather than grow into evaluation).
 *
 * Expectations were derived by reading each source file, not by blessing the
 * parser's output.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractCanvas } from '../src/client/canvas/extract'
import type { CanvasNode } from '../src/client/canvas/ir'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string): string => readFileSync(resolve(here, 'fixtures', name), 'utf8')

type El = Extract<CanvasNode, { kind: 'element' }>

function parse(name: string): El {
  const result = extractCanvas(read(name))
  if (!result.ok) throw new Error(`${name}: ${result.error.code} ${result.error.message}`)
  return result.root as El
}

function all(root: CanvasNode, tag: string): El[] {
  const out: El[] = []
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    if (n.tag === tag) out.push(n)
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

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

function unresolvedNames(root: CanvasNode): string[] {
  const out: string[] = []
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    out.push(...(n.unresolved ?? []))
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

function unsupportedCount(root: CanvasNode): number {
  let n = 0
  const visit = (node: CanvasNode): void => {
    if (node.kind === 'unsupported') n++
    if (node.kind === 'element') node.children.forEach(visit)
  }
  visit(root)
  return n
}

describe('corpus fixtures — all four parse cleanly', () => {
  const names = [
    'corpus-cmp-vendors-report.canvas.tsx',
    'corpus-react-migration-report.canvas.tsx',
    'corpus-deepseek-harness-docs-report.canvas.tsx',
    'corpus-bdd-fix-summary.canvas.tsx',
  ]

  it.each(names)('%s parses without error', name => {
    const result = extractCanvas(read(name))
    expect(result.ok, `${name} failed`).toBe(true)
  })
})

describe('rule 5 applied — canvasImage-backed screenshots resolve', () => {
  it('cmp-vendors: every <img src> resolves to its literal path', () => {
    const root = parse('corpus-cmp-vendors-report.canvas.tsx')
    const imgs = all(root, 'img')
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img.unresolved, 'src must resolve').toBeUndefined()
      expect(typeof img.props.src).toBe('string')
      expect(img.props.src as string).toMatch(/\.png$/)
    }
    // Was `unr 3` before the extension.
    expect(unresolvedNames(root)).toEqual([])
  })
})

describe('rule 3 applied — function-body const tables resolve', () => {
  it('react-migration: rows={techStack}/{chapters}/{buildOutput} all resolve', () => {
    const root = parse('corpus-react-migration-report.canvas.tsx')
    expect(unresolvedNames(root)).toEqual([])
    const tables = all(root, 'Table')
    expect(tables.length).toBeGreaterThanOrEqual(3)
    // Independently read from the source: `const techStack = [['Vite 8', …], …]`.
    expect(tables[0]?.props.rows).toEqual([
      ['Vite 8', '构建工具', '217ms 构建'],
      ['React 18', 'UI 框架', '组件化架构'],
      ['TypeScript', '类型系统', '0 编译错误'],
      ['Tailwind CSS 4', '样式方案', '26.39 KB gzip'],
      ['Zustand', '状态管理', '轻量全局状态'],
    ])
  })
})

describe('rules 2+3 applied — module consts with `as const` resolve', () => {
  it('deepseek-harness-docs: MetricsGrid items come from the module const', () => {
    const root = parse('corpus-deepseek-harness-docs-report.canvas.tsx')
    // The 2 remaining gaps are the invalid-TSX prose, not props.
    expect(unresolvedNames(root)).toEqual([])
    const grids = all(root, 'MetricsGrid')
    expect(grids.length).toBeGreaterThan(0)
    const items = grids[0]?.props.items
    expect(Array.isArray(items)).toBe(true)
    expect((items as Array<Record<string, unknown>>)[0]).toMatchObject({
      label: '收集文档',
      value: '215',
      unit: '篇',
    })
  })

  it('deepseek-harness-docs: `tone: "danger" as const` inside a const is stripped', () => {
    const root = parse('corpus-deepseek-harness-docs-report.canvas.tsx')
    // The improvements const carries a nested `as const`; the cascade survived.
    expect(census(root).Table).toBeGreaterThan(0)
    expect(unsupportedCount(root)).toBe(2)
  })
})

describe('boundary — genuinely dynamic forms stay unresolved', () => {
  it('bdd-fix-summary keeps both dynamic props alone, and still renders', () => {
    const root = parse('corpus-bdd-fix-summary.canvas.tsx')
    // `<Table rows={tasks.map(t => [t.id, …, t.status === 'complete' ? … ])}
    //         rowTone={tasks.map(t => statusTone(t.status))}>`
    // Both contain forms deliberately outside the closed rules: a conditional
    // and a nested call. Note `rowTone` reached the map-projection path but its
    // body calls `statusTone(...)`, which is not reducible — correct refusal.
    expect(unresolvedNames(root)).toEqual(['rows', 'rowTone'])
    // The element itself survives — only those two props are dropped.
    const table = all(root, 'Table').find(t => t.unresolved !== undefined)
    expect(table).toBeDefined()
    expect(table?.props.headers).toBeDefined()
  })

  it('never throws on any corpus fixture, whatever it contains', () => {
    for (const name of [
      'corpus-cmp-vendors-report.canvas.tsx',
      'corpus-react-migration-report.canvas.tsx',
      'corpus-deepseek-harness-docs-report.canvas.tsx',
      'corpus-bdd-fix-summary.canvas.tsx',
    ]) {
      expect(() => extractCanvas(read(name))).not.toThrow()
    }
  })
})
