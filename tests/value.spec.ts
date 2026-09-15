/**
 * Static resolver guards (checklist B17–B21).
 *
 * The extension to the closed rule set was driven by a corpus audit of 41 real
 * canvas files, which found 88 props dropping out — tables, metric grids and
 * screenshots rendering EMPTY. These tests pin the exact forms that were added
 * so the behaviour cannot silently regress, and pin the boundary so the rule
 * set cannot silently grow into real evaluation.
 */
import { describe, expect, it } from 'vitest'
import {
  collectFunctionConsts,
  collectModuleConsts,
  createResolver,
  resolveValue,
  stripAsAssertion,
  UNSUPPORTED,
} from '../src/client/canvas/value'
import { extractCanvas } from '../src/client/canvas/extract'
import type { CanvasNode } from '../src/client/canvas/ir'

const ctx = (consts: Record<string, string> = {}, imports: string[] = []) => ({
  consts: new Map(Object.entries(consts)),
  imports: new Set(imports),
  depth: 0,
})

describe('rule 1 — undefined / null are keywords, not expressions', () => {
  it('maps undefined and null to null', () => {
    expect(resolveValue('undefined', ctx())).toBeNull()
    expect(resolveValue('null', ctx())).toBeNull()
  })

  it('keeps them inside arrays (the rowTone={["accent", undefined, …]} form)', () => {
    expect(resolveValue('["accent", undefined, undefined]', ctx())).toEqual(['accent', null, null])
  })
})

describe('rule 2 — `as` assertions are erased at runtime', () => {
  it('strips `as const`', () => {
    expect(stripAsAssertion('"success" as const')).toBe('"success"')
    expect(resolveValue('"success" as const', ctx())).toBe('success')
  })

  it('strips a named type assertion', () => {
    expect(resolveValue("'danger' as Tone", ctx())).toBe('danger')
  })

  it('does not strip when `as` is not an assertion', () => {
    expect(stripAsAssertion('"as"')).toBeNull()
  })

  it('resolves an object whose property carries an assertion', () => {
    expect(resolveValue('{ tone: "danger" as const, label: "P0" }', ctx())).toEqual({
      tone: 'danger',
      label: 'P0',
    })
  })
})

describe('rule 3 — module-level and function-body const bindings', () => {
  const src = `
const headlineMetrics = [{ label: "收集文档", value: "215" }];
export default function Report() {
  const chapters = [["Ch1", "完成"], ["Ch2", "进行中"]];
  return <MetricsGrid items={headlineMetrics} />;
}
`
  it('collects module-level consts', () => {
    expect(collectModuleConsts(src).get('headlineMetrics')).toBe('[{ label: "收集文档", value: "215" }]')
  })

  it('collects consts declared inside the default export body', () => {
    // Real files (react-migration-report) declare their tables inside the component.
    expect(collectFunctionConsts(src).get('chapters')).toBe('[["Ch1", "完成"], ["Ch2", "进行中"]]')
  })

  it('resolves a reference through both scopes', () => {
    const resolve = createResolver(src, new Set())
    expect(resolve('headlineMetrics')).toEqual([{ label: '收集文档', value: '215' }])
    expect(resolve('chapters')).toEqual([
      ['Ch1', '完成'],
      ['Ch2', '进行中'],
    ])
  })

  it('refuses to resolve an imported name', () => {
    const resolve = createResolver('export default function R() { return null }', new Set(['foo']))
    expect(resolve('foo')).toBe(UNSUPPORTED)
  })

  it('refuses a self-referential const instead of looping', () => {
    const c = ctx({ loop: 'loop' })
    expect(resolveValue('loop', c)).toBe(UNSUPPORTED)
  })

  it('refuses an unknown identifier', () => {
    expect(resolveValue('whoKnows', ctx())).toBe(UNSUPPORTED)
  })
})

describe('rule 4 — `.map()` projections over a static array', () => {
  const consts = {
    verification: '[{ check: "文件完整性", result: "源 215 个全部复制" }, { check: "数量核对", result: "一致" }]',
    chapters: '["a", "b", "c"]',
  }

  it('projects a tuple body', () => {
    expect(resolveValue('verification.map((v) => [v.check, v.result])', ctx(consts))).toEqual([
      ['文件完整性', '源 215 个全部复制'],
      ['数量核对', '一致'],
    ])
  })

  it('projects without parenthesised params', () => {
    expect(resolveValue('verification.map(v => [v.check])', ctx(consts))).toEqual([
      ['文件完整性'],
      ['数量核对'],
    ])
  })

  it('repeats a constant body (the chapters.map(() => "success") form)', () => {
    expect(resolveValue("chapters.map(() => 'success' as const)", ctx(consts))).toEqual([
      'success',
      'success',
      'success',
    ])
  })

  it('refuses a projection over a non-static receiver', () => {
    expect(resolveValue('someVar.map((v) => [v.a])', ctx(consts))).toBe(UNSUPPORTED)
  })

  it('refuses a member that does not exist on the record', () => {
    expect(resolveValue('verification.map((v) => [v.missing])', ctx(consts))).toBe(UNSUPPORTED)
  })
})

describe('rule 5 — canvasImage() is a documented identity over a string literal', () => {
  it('unwraps the literal', () => {
    expect(resolveValue('canvasImage("./walk-cmp-hosts.png")', ctx())).toBe('./walk-cmp-hosts.png')
  })

  it('refuses a non-literal argument', () => {
    expect(resolveValue('canvasImage(somePath)', ctx())).toBe(UNSUPPORTED)
  })

  it('resolves through a const binding (the screenshot form)', () => {
    const c = ctx({ hostShot: 'canvasImage("./walk-cmp-hosts.png")' })
    expect(resolveValue('hostShot', c)).toBe('./walk-cmp-hosts.png')
  })
})

describe('boundary — the rule set must NOT grow into evaluation', () => {
  it.each([
    ['nested call', 'statusTone(t.status)'],
    ['conditional', "t.status === 'complete' ? '完成' : '进行中'"],
    ['member chain', 'a.b.c'],
    ['call expression', 'foo()'],
    ['template substitution', '`x ${y}`'],
    ['arithmetic', '1 + 2'],
    ['new expression', 'new Date()'],
    ['iife', '(() => 1)()'],
    ['await', 'await load()'],
  ])('refuses %s', (_label, expr) => {
    expect(resolveValue(expr, ctx({ a: '{ b: {} }' }))).toBe(UNSUPPORTED)
  })
})

describe('end-to-end through extractCanvas', () => {
  const source = `
import { Table, MetricsGrid, Stack, Text } from 'qoder/canvas';

const metrics = [{ label: "文档", value: "215" }];

export default function Report() {
  const rows = [["a", "b"]];
  const shot = canvasImage("./shot.png");
  return (
    <Stack gap={20}>
      <MetricsGrid items={metrics} columns={3} />
      <Table headers={["k", "v"]} rows={rows} rowTone={["success", undefined]} />
      <Text>{shot}</Text>
      <Text>{dynamicValue}</Text>
    </Stack>
  );
}
`
  const root = (() => {
    const r = extractCanvas(source)
    if (!r.ok) throw new Error(r.error.message)
    return r.root as Extract<CanvasNode, { kind: 'element' }>
  })()

  const find = (tag: string): Extract<CanvasNode, { kind: 'element' }> | undefined => {
    let hit: Extract<CanvasNode, { kind: 'element' }> | undefined
    const visit = (n: CanvasNode): void => {
      if (n.kind !== 'element') return
      if (n.tag === tag && hit === undefined) hit = n
      n.children.forEach(visit)
    }
    visit(root)
    return hit
  }

  it('resolves the data props that used to drop out', () => {
    expect(find('MetricsGrid')?.props.items).toEqual([{ label: '文档', value: '215' }])
    expect(find('Table')?.props.rows).toEqual([['a', 'b']])
    expect(find('Table')?.props.rowTone).toEqual(['success', null])
  })

  it('records only the genuinely unresolvable node, and still renders it', () => {
    const texts = (() => {
      const out: Array<Extract<CanvasNode, { kind: 'element' }>> = []
      const visit = (n: CanvasNode): void => {
        if (n.kind !== 'element') return
        if (n.tag === 'Text') out.push(n)
        n.children.forEach(visit)
      }
      visit(root)
      return out
    })()
    // The canvasImage-backed Text resolves to plain text, with no prop gaps.
    expect(texts[0]?.unresolved).toBeUndefined()
    expect(texts[0]?.children.some(c => c.kind === 'unsupported')).toBe(false)
    // The dynamic child is a CHILD, not a prop: it becomes an `unsupported`
    // node (so `unresolved` stays undefined — that list is props-only), and the
    // element still renders around it.
    expect(texts[1]?.unresolved).toBeUndefined()
    expect(texts[1]?.children.some(c => c.kind === 'unsupported')).toBe(true)
  })
})

describe('statement scanning — files that omit semicolons (ASI)', () => {
  // Real corpus files are written both ways. Without ASI handling the scanner
  // folded every following `const` into the first initialiser, so
  // `const home = canvasImage('./home.png')` became one giant string and every
  // `<img src={home}>` silently dropped out of the IR.
  const noSemicolons = `
import { Stack, canvasImage } from 'qoder/canvas'

const home = canvasImage('./home.png')
const waiting = canvasImage('./waiting.png')

export default function Report() {
  return (
    <Stack>
      <img src={home} alt="home" />
    </Stack>
  )
}
`

  it('keeps each module const on its own statement', () => {
    const consts = collectModuleConsts(noSemicolons)
    expect(consts.get('home')).toBe("canvasImage('./home.png')")
    expect(consts.get('waiting')).toBe("canvasImage('./waiting.png')")
  })

  it('resolves an img src through its const binding', () => {
    const result = extractCanvas(noSemicolons)
    if (!result.ok) throw new Error(result.error.message)
    let img: Extract<CanvasNode, { kind: 'element' }> | undefined
    const visit = (n: CanvasNode): void => {
      if (n.kind !== 'element') return
      if (n.tag === 'img') img = n
      n.children.forEach(visit)
    }
    visit(result.root)
    expect(img?.props.src).toBe('./home.png')
    expect(img?.unresolved).toBeUndefined()
  })

  it('does not cut a statement at a continuation line break', () => {
    const consts = collectModuleConsts(`const joined = 'a' +\n  'b'\nconst n = 1\n`)
    expect(consts.get('joined')).toBe("'a' +\n  'b'")
    expect(consts.get('n')).toBe('1')
  })

  it('does not cut a statement at a continuation-leading line break', () => {
    const consts = collectModuleConsts(`const chained = base\n  .map((v) => v.a)\nconst n = 1\n`)
    expect(consts.get('chained')).toBe('base\n  .map((v) => v.a)')
    expect(consts.get('n')).toBe('1')
  })

  it('handles a multi-line bracketed initialiser without a semicolon', () => {
    const consts = collectModuleConsts(`const rows = [\n  ['a', 'b'],\n  ['c', 'd'],\n]\nconst n = 1\n`)
    expect(consts.get('rows')).toBe("[\n  ['a', 'b'],\n  ['c', 'd'],\n]")
    expect(consts.get('n')).toBe('1')
  })

  it('still stops at an explicit semicolon', () => {
    const consts = collectModuleConsts(`const a = 1; const b = 2;\n`)
    expect(consts.get('a')).toBe('1')
    expect(consts.get('b')).toBe('2')
  })
})
