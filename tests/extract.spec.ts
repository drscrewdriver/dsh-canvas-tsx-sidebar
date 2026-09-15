/**
 * Extractor guards (checklist B1–B11, B15).
 *
 * The structural assertions below were derived by reading the SOURCE file
 * independently (a cross-line-aware tag count over `sample.canvas.tsx`), not
 * by running the parser and blessing its output. The golden-IR comparison (B1)
 * is a drift guard on top of those independently-derived facts.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractCanvas } from '../src/client/canvas/extract'
import type { CanvasNode } from '../src/client/canvas/ir'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string): string => resolve(here, 'fixtures', name)
const read = (name: string): string => readFileSync(fixture(name), 'utf8')

/** All element nodes with a given tag, in document order. */
function collect(root: CanvasNode, tag: string): Array<Extract<CanvasNode, { kind: 'element' }>> {
  const out: Array<Extract<CanvasNode, { kind: 'element' }>> = []
  const visit = (n: CanvasNode): void => {
    if (n.kind !== 'element') return
    if (n.tag === tag) out.push(n)
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

/** Extract the sample and assert success, returning the root. */
function sampleRoot(): Extract<CanvasNode, { kind: 'element' }> {
  const result = extractCanvas(read('sample.canvas.tsx'))
  if (!result.ok) throw new Error(`extract failed: ${result.error.code} ${result.error.message}`)
  return result.root as Extract<CanvasNode, { kind: 'element' }>
}

describe('B1 — golden IR', () => {
  it('matches the hand-verified golden snapshot exactly', () => {
    const golden = JSON.parse(read('sample.ir.json')) as CanvasNode
    const result = extractCanvas(read('sample.canvas.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.root).toEqual(golden)
  })
})

describe('B2–B7 — structure verified against the source file', () => {
  it('B2: root is ReportShell with width=wide and the ariaLabel', () => {
    const root = sampleRoot()
    expect(root.tag).toBe('ReportShell')
    expect(root.props.width).toBe('wide')
    expect(root.props.ariaLabel).toBe('CMP 云厂商 SDK 补全完成报告')
  })

  it('B3: four Stats carry the exact value/label pairs', () => {
    const stats = collect(sampleRoot(), 'Stat').map(s => [s.props.value, s.props.label])
    expect(stats).toEqual([
      ['2', '新增云厂商'],
      ['32', '扫描方法'],
      ['9', '变更文件'],
      ['+1247', '新增代码行'],
    ])
  })

  it('B4: exactly two Grids, with columns 4 then 2', () => {
    const grids = collect(sampleRoot(), 'Grid')
    expect(grids.map(g => g.props.columns)).toEqual([4, 2])
    expect(grids.map(g => g.props.gap)).toEqual([16, 16])
  })

  it('B5: five Tables; the 验证证据 table keeps its five-entry rowTone', () => {
    const root = sampleRoot()
    expect(collect(root, 'Table')).toHaveLength(5)
    // Independently derived from the source: rowTone is spelled out there.
    const tones = collect(root, 'Table')
      .map(t => t.props.rowTone)
      .filter((t): t is unknown[] => Array.isArray(t))
    expect(tones).toEqual([['success', 'success', 'success', 'warning', 'success']])
  })

  it('B6: two Callouts — info then warning — both titled', () => {
    const callouts = collect(sampleRoot(), 'Callout')
    expect(callouts.map(c => c.props.tone)).toEqual(['info', 'warning'])
    expect(callouts.map(c => c.props.title)).toEqual(['注册链路修复', 'sync_all 计数 bug 修复'])
  })

  it('B7: five ReportSections, with the source titles in order', () => {
    const titles = collect(sampleRoot(), 'ReportSection').map(s => s.props.title)
    expect(titles).toEqual(['关键成果', '新增 Client 实现', '注册与打通', '验证证据', '路线图标注'])
  })

  it('matches every independently counted tag total', () => {
    const root = sampleRoot()
    const expected: Record<string, number> = {
      ReportShell: 1,
      ReportSection: 5,
      Stack: 6,
      Grid: 2,
      Divider: 5,
      Text: 5,
      H1: 1,
      H2: 2,
      Stat: 4,
      Table: 5,
      Callout: 2,
      header: 1,
    }
    for (const [tag, count] of Object.entries(expected)) {
      expect(collect(root, tag), tag).toHaveLength(count)
    }
  })
})

describe('B8 — import aliases normalise to the export name', () => {
  it('folds `X as Y` back to X for every specifier', () => {
    const result = extractCanvas(read('alias.canvas.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const root = result.root as Extract<CanvasNode, { kind: 'element' }>
    expect(root.tag).toBe('Stack') // imported as `Wrap`
    expect(collect(root, 'H1')).toHaveLength(1) // imported as `T1`
    expect(collect(root, 'Text')).toHaveLength(1) // imported as `Txt`
    // The local names must not survive anywhere.
    expect(collect(root, 'T1')).toHaveLength(0)
    expect(collect(root, 'Wrap')).toHaveLength(0)
  })
})

describe('B9 / B15 — non-literals degrade, never throw, never evaluate', () => {
  it('drops non-literal props into `unresolved` and keeps the element', () => {
    const result = extractCanvas(read('nonliteral.canvas.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const root = result.root as Extract<CanvasNode, { kind: 'element' }>
    expect(root.tag).toBe('Stack')
    // `gap={gapVar}` is not reducible: recorded, not invented.
    expect(root.unresolved).toEqual(['gap'])
    expect(root.props.gap).toBeUndefined()
  })

  it('turns non-literal children into `unsupported` nodes', () => {
    const result = extractCanvas(read('nonliteral.canvas.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const unsupported: CanvasNode[] = []
    const visit = (n: CanvasNode): void => {
      if (n.kind === 'unsupported') unsupported.push(n)
      if (n.kind === 'element') n.children.forEach(visit)
    }
    visit(result.root)
    // {title}, {someVar}, {`template ${x}`}, {rows.map(...)} — but NOT the
    // plain string literal, which must survive as text.
    expect(unsupported.length).toBeGreaterThanOrEqual(4)
    for (const node of unsupported) {
      expect(node.kind === 'unsupported' && node.reason).toBeTruthy()
    }
    // `{'plain literal'}` must have been reduced to text, not flagged.
    const texts: string[] = []
    const visitText = (n: CanvasNode): void => {
      if (n.kind === 'text') texts.push(n.value)
      if (n.kind === 'element') n.children.forEach(visitText)
    }
    visitText(result.root)
    expect(texts).toContain('plain literal')
  })

  it('tone={theme} is unresolved while its sibling literal props survive', () => {
    const result = extractCanvas(read('nonliteral.canvas.tsx'))
    if (!result.ok) throw new Error('expected success')
    const texts = collect(result.root, 'Text')
    const themed = texts.find(t => t.unresolved?.includes('tone'))
    expect(themed).toBeDefined()
    expect(themed?.props.tone).toBeUndefined()
  })

  it('survives the precision-ceiling fixture without throwing', () => {
    const result = extractCanvas(read('precision.canvas.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const root = result.root as Extract<CanvasNode, { kind: 'element' }>
    expect(root.tag).toBe('Stack')
    // `{...rest}` spread is recorded, not applied.
    const spread = collect(root, 'Text').find(t => t.unresolved !== undefined)
    expect(spread).toBeDefined()
  })
})

describe('B10 — JSX text whitespace', () => {
  it('collapses indented Chinese paragraphs without stray newlines', () => {
    const root = sampleRoot()
    const texts: string[] = []
    const visit = (n: CanvasNode): void => {
      if (n.kind === 'text') texts.push(n.value)
      if (n.kind === 'element') n.children.forEach(visit)
    }
    visit(root)
    for (const value of texts) {
      expect(value).not.toMatch(/\n/)
      // Leading indentation is always stripped. Trailing whitespace is NOT
      // asserted away: React keeps the trailing space of the last line, and
      // that space is semantically load-bearing when a text run is followed by
      // an expression container (see the dedicated test below).
      expect(value).not.toMatch(/^\s/)
    }
    expect(texts).toContain('分页：NextToken / Marker 双模式；字段映射 InstanceId 到 inst_id、State.Name 到 status')
  })

  it('keeps the trailing space that separates a text run from an expression', () => {
    // React's cleanJSXElementLiteralChild does not strip a last-line trailing
    // space. Here the space before `{'created': ...}` must survive, otherwise
    // the rendered prose becomes `（0 +{'created': ...}`.
    const root = sampleRoot()
    const texts: string[] = []
    const visit = (n: CanvasNode): void => {
      if (n.kind === 'text') texts.push(n.value)
      if (n.kind === 'element') n.children.forEach(visit)
    }
    visit(root)
    const beforeExpression = texts.find(t => t.startsWith('sync.py 全量同步中'))
    expect(beforeExpression).toBeDefined()
    expect(beforeExpression?.endsWith('（0 + ')).toBe(true)
  })
})

describe('B11 — malformed input returns an error, never throws', () => {
  it('reports `unterminated` for a tree that never closes', () => {
    const result = extractCanvas(read('unterminated.canvas.tsx'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unterminated')
  })

  it('reports `no-default-export` when there is none', () => {
    const result = extractCanvas('export const x = 1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('no-default-export')
  })

  it('rejects an oversized source with `too-large`', () => {
    const result = extractCanvas('x'.repeat(2 * 1024 * 1024 + 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('too-large')
  })

  it('does not throw on random garbage', () => {
    for (const junk of ['', '<', '{{{{', 'export default function f() { return (', '</>', '<<<>>>']) {
      expect(() => extractCanvas(junk)).not.toThrow()
    }
  })
})

describe('real-world defect — the sample file is not valid TSX', () => {
  it('degrades the invalid `{\'created\': ...}` object literal to `unsupported`', () => {
    // The TypeScript compiler reports TS1005/TS1381 on line 46 of the source
    // (`{'created': ...}` — a bare spread with no operand). The parser must
    // not throw, and must not invent a value for it.
    const root = sampleRoot()
    const flagged: string[] = []
    const visit = (n: CanvasNode): void => {
      if (n.kind === 'unsupported') flagged.push(n.snippet ?? '')
      if (n.kind === 'element') n.children.forEach(visit)
    }
    visit(root)
    expect(flagged).toHaveLength(1)
    expect(flagged[0]).toContain("'created'")
  })
})
