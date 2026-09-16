/**
 * Renderer contract tests.
 *
 * The renderer is the one place where a parsing decision becomes visible, so
 * these assert on the RENDERED MARKUP rather than on the IR: a change that
 * keeps the IR intact but drops a heading is exactly the regression this file
 * exists to catch.
 *
 * Expectations are derived from the SDK contracts and from Qoder's native
 * canvas output, not blessed from whatever the renderer happens to emit.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { extractCanvas } from '../src/client/canvas/extract'
import { CanvasDocument, renderNode } from '../src/client/canvas/render'
import { CANVAS_CSS, CANVAS_ROOT_CLASS } from '../src/client/canvas/styles'
import type { CanvasNode } from '../src/client/canvas/ir'

/** Parse a source string, failing loudly on a parse error. */
function ir(source: string): CanvasNode {
  const result = extractCanvas(source)
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.root
}

/** Wrap a source body in the minimal canvas file shape. */
function canvas(body: string): string {
  return `import { ${importsOf(body)} } from 'qoder/canvas';\nexport default function Report() {\n  return (\n${body}\n  );\n}\n`
}

/** Every capitalised tag used in a body, so the import line stays honest. */
function importsOf(body: string): string {
  return [...new Set([...body.matchAll(/<([A-Z][\w]*)/g)].map(m => m[1] as string))].join(', ')
}

/** Render a whole document to markup. */
function html(source: string, resolveImage?: (ref: string) => string | undefined): string {
  return renderToStaticMarkup(
    CanvasDocument({
      root: ir(source),
      options: resolveImage === undefined ? {} : { resolveImage },
    }),
  )
}

describe('shell — exactly one paper card, whatever the root tag is', () => {
  it('a ReportShell root is not wrapped a second time', () => {
    const out = html(canvas('<ReportShell><H1>Title</H1></ReportShell>'))
    expect(out.match(/class="report-shell"/g)).toHaveLength(1)
  })

  it('a Stack root still gets a card', () => {
    // Corpus reality: several files root at <Stack>, and a bare Stack renders
    // as an unstyled div on whatever background the host happens to have.
    const out = html(canvas('<Stack><H1>Title</H1></Stack>'))
    expect(out.match(/class="report-shell"/g)).toHaveLength(1)
  })

  it('the scoping root is always present', () => {
    expect(html(canvas('<Stack><H1>T</H1></Stack>'))).toContain(`class="${CANVAS_ROOT_CLASS}"`)
  })
})

describe('stylesheet — every rule is scoped to the document root', () => {
  it('no selector can leak into the host sidebar UI', () => {
    // Bare `.card` / `.table` / `*` rules inside the DSH sidebar would restyle
    // the host's own chrome. This is the guard for that.
    //
    // Comments are stripped first: prose legitimately contains braces (e.g. a
    // mention of `columns={4}`), and scanning raw text reported those as
    // unscoped selectors.
    const rules = CANVAS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const offenders: string[] = []
    for (const line of rules.split('\n')) {
      for (const match of line.matchAll(/([^{}]+)\{/g)) {
        const selector = (match[1] as string).trim()
        if (selector.startsWith('@')) continue
        if (!selector.includes(`.${CANVAS_ROOT_CLASS}`)) offenders.push(selector)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('container queries are scoped too', () => {
    // `@container` rules carry their own selectors inside the block; the guard
    // above cannot see them because the `@container` line itself is skipped.
    const blocks = CANVAS_CSS.match(/@container[^{]*\{([\s\S]*?)\n\}/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      // Drop the at-rule prelude (`@container (max-width: …)`) — only the
      // declarations inside the block carry selectors.
      const body = block.slice(block.indexOf('{') + 1)
      for (const match of body.matchAll(/([^{}]+)\{/g)) {
        expect((match[1] as string).trim()).toContain(`.${CANVAS_ROOT_CLASS}`)
      }
    }
  })
})

describe('Grid — the column count never passes through an intermediate step', () => {
  it('columns={4} emits a fixed 4-track grid plus the drop-to-2 breakpoint', () => {
    const out = html(canvas('<Grid columns={4}><Text>a</Text></Grid>'))
    expect(out).toContain('grid grid-4')
    expect(out).toContain('grid-template-columns:repeat(4, 1fr)')
    // `auto-fit` would let the browser pick 3 columns on the way down.
    expect(out).not.toContain('auto-fit')
  })

  it('the 4 -> 2 breakpoint exists and skips 3', () => {
    // Container query measures the sidebar's own width, not the viewport: a
    // narrow sidebar inside a wide window still collapses.
    expect(CANVAS_CSS).toContain('@container (max-width: 560px)')
    // `page-wrap` and `grid` are the measurement roots.
    expect(CANVAS_CSS).toMatch(/\.page-wrap\s*\{[^}]*container-type:\s*inline-size/)
    expect(CANVAS_CSS).toMatch(/\.grid\s*\{[^}]*container-type:\s*inline-size/)
    // Fallback @media for engines without container query support.
    expect(CANVAS_CSS).toContain('@media (max-width: 560px)')
    // 4 collapses straight to 2 — a `repeat(3, …)` track would mean an
    // intermediate step came back.
    expect(CANVAS_CSS).toMatch(/\.grid-4\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    expect(CANVAS_CSS).not.toContain('repeat(3,')
  })
})

describe('Table — both prop shapes render', () => {
  it('headers + rows (positional)', () => {
    const out = html(
      canvas(`<Table headers={['Name', 'Status']} rows={[['build', 'ok'], ['lint', 'ok']]} />`),
    )
    expect(out).toContain('<th class="th">Name</th>')
    expect(out).toContain('<td class="td">build</td>')
    expect(out.match(/<tr class="tr"/g)).toHaveLength(2)
  })

  it('columns + data (keyed)', () => {
    const out = html(
      canvas(
        `<Table columns={[{ key: 'k', label: 'Key' }, { key: 'v', label: 'Value' }]} data={[{ k: 'a', v: '1' }]} />`,
      ),
    )
    expect(out).toContain('<th class="th">Key</th>')
    expect(out).toContain('<td class="td">a</td>')
  })

  it('rowTone colours the right row', () => {
    const out = html(
      canvas(
        `<Table columns={[{ key: 'v', label: 'V' }]} data={[{ v: 'pass' }, { v: 'fail' }]} rowTone={['success', 'danger']} />`,
      ),
    )
    expect(out).toContain('<tr class="tr tr-success">')
    expect(out).toContain('<tr class="tr tr-danger">')
  })

  it('columns + rows — the SDK names the row array `rows`, not `data`', () => {
    // `ModernTableProps` is `{ columns, rows, rowTone }` (core-primitives.d.ts:319).
    // `columns + data` above is this renderer's own older spelling. Both are
    // legal in the SDK, so both must render; a `rows` file used to come out
    // completely empty.
    const out = html(
      canvas(`<Table columns={[{ key: 'v', title: 'V' }]} rows={[{ v: 'pass' }]} />`),
    )
    expect(out).toContain('<th class="th">V</th>')
    expect(out).toContain('<td class="td">pass</td>')
  })

  it('a TableColumn is labelled by `title` before falling back to `key`', () => {
    // SDK `TableColumn` is `{ key, title?, header? }` — `key` is the field name,
    // `title` is what a human reads. Preferring `key` printed the raw field name.
    const out = html(
      canvas(`<Table columns={[{ key: 'scan_methods', title: '扫描方法' }]} rows={[{ scan_methods: '32' }]} />`),
    )
    expect(out).toContain('<th class="th">扫描方法</th>')
    expect(out).not.toContain('<th class="th">scan_methods</th>')
    // The cell still reads the field named by `key`.
    expect(out).toContain('<td class="td">32</td>')
  })

  it('legacy headers + rows is not swallowed by the modern branch', () => {
    // `rows` carries positional arrays in the legacy shape. They must not be
    // mistaken for records just because the modern branch also reads `rows`.
    const out = html(canvas(`<Table headers={['a', 'b']} rows={[['1', '2']]} />`))
    expect(out).toContain('<th class="th">a</th>')
    expect(out).toContain('<td class="td">1</td>')
    expect(out).toContain('<td class="td">2</td>')
  })
})

describe('MetricsGrid — the SDK names its column prop `columns`', () => {
  it('columns={4} raises the track floor to 240px', () => {
    const out = html(canvas(`<MetricsGrid columns={4} items={[{ label: 'a', value: '1' }]} />`))
    expect(out).toContain('minmax(240px, 1fr)')
  })

  it('three or fewer columns keeps the 200px floor', () => {
    const out = html(canvas(`<MetricsGrid columns={3} items={[{ label: 'a', value: '1' }]} />`))
    expect(out).toContain('minmax(200px, 1fr)')
  })

  it('the older `cols` spelling still works', () => {
    const out = html(canvas(`<MetricsGrid cols={4} items={[{ label: 'a', value: '1' }]} />`))
    expect(out).toContain('minmax(240px, 1fr)')
  })

  it('no column prop at all falls back to the 3-column floor', () => {
    const out = html(canvas(`<MetricsGrid items={[{ label: 'a', value: '1' }]} />`))
    expect(out).toContain('minmax(200px, 1fr)')
  })

  it('`metrics` is still accepted as an alias of `items`', () => {
    const out = html(canvas(`<MetricsGrid metrics={[{ label: 'L', value: '9' }]} />`))
    expect(out).toContain('metric-label">L<')
    expect(out).toContain('metric-value">9<')
  })
})

describe('Stat — tone drives the value colour', () => {
  it('success paints green, danger red, and an unknown tone stays default', () => {
    const out = html(
      canvas(
        '<Stack><Stat label="ok" value="1" tone="success" /><Stat label="bad" value="2" tone="danger" /><Stat label="x" value="3" /></Stack>',
      ),
    )
    expect(out).toContain('color:#16a34a')
    expect(out).toContain('color:#dc2626')
    expect(out).toContain('color:#111827')
  })

  it('every SDK Tone value paints, including added/deleted', () => {
    // `StatTone` is the shared `Tone` union, so `added`/`deleted` are legal and
    // must not quietly fall through to the default black.
    const out = html(
      canvas('<Stack><Stat label="a" value="1" tone="added" /><Stat label="d" value="2" tone="deleted" /></Stack>'),
    )
    expect(out).toContain('color:#16a34a')
    expect(out).toContain('color:#dc2626')
  })
})

describe('Timeline — SDK field names, not the older spelling', () => {
  it('reads timestamp/title/description/state', () => {
    const out = html(
      canvas(
        `<Timeline items={[{ timestamp: '09:00', title: 'Build', description: 'green', state: 'completed' }]} />`,
      ),
    )
    expect(out).toContain('09:00')
    expect(out).toContain('Build')
    expect(out).toContain('green')
    expect(out).toContain('background:#3b82f6')
  })
})

describe('images — resolved through the seam, never guessed', () => {
  const source = canvas(`<img src={shot} alt="首页" />`)
  const withImage = `import { canvasImage } from 'qoder/canvas';\nconst shot = canvasImage('./igw-01-home.png')\n${source.slice(source.indexOf('export'))}`

  it('the canvasImage reference survives into the IR', () => {
    // The source roots at <img>, so the img IS the root node here.
    const root = ir(withImage) as Extract<CanvasNode, { kind: 'element' }>
    expect(root.tag).toBe('img')
    expect(root.props.src).toBe('./igw-01-home.png')
    expect(root.unresolved).toBeUndefined()
  })

  it('a missing resolver seam falls back to the literal reference', () => {
    // No seam at all: `data:` / `http(s)` literals are valid src values already.
    const out = html(withImage)
    expect(out).toContain('src="./igw-01-home.png"')
  })

  it('resolveImage controls the src', () => {
    const out = html(withImage, ref => `https://example.test/${ref.replace('./', '')}`)
    expect(out).toContain('src="https://example.test/igw-01-home.png"')
    expect(out).toContain('alt="首页"')
  })

  it('an unresolvable reference renders the labelled placeholder', () => {
    const out = html(withImage, () => undefined)
    expect(out).toContain('canvas-image-placeholder')
    expect(out).toContain('未找到')
  })
})

describe('fidelity notices — a gap is shown, never hidden', () => {
  it('an unsupported subtree renders as a notice', () => {
    const out = renderToStaticMarkup(
      renderNode({ kind: 'unsupported', reason: 'non-literal child expression', snippet: 'fn()' }),
    )
    expect(out).toContain('class="unsupported"')
    expect(out).toContain('fn()')
  })

  it('an unmapped component keeps its children and names itself', () => {
    const out = html(canvas('<RadarChart data={[1, 2]}><Text>inner</Text></RadarChart>'))
    expect(out).toContain('class="unknown-component"')
    expect(out).toContain('data-tag="RadarChart"')
    expect(out).toContain('inner')
  })

  it('a lowercase native tag passes through with NO notice', () => {
    // The parser keeps lowercase tags verbatim as native HTML, and the corpus
    // really does wrap report headers in `<header>`. Warning about it would be
    // a false fidelity report — and it was: every `<header>` used to render a
    // dashed "⚠ header" box.
    const out = html(
      canvas('<Stack><header><Text>title</Text></header><main><Text>body</Text></main></Stack>'),
    )
    expect(out).toContain('<header>')
    expect(out).toContain('<main>')
    expect(out).not.toContain('unknown-component')
  })

  it('a native tag keeps a scalar style and drops a nested one', () => {
    const out = html(canvas('<div style={{ padding: 4, nested: { a: 1 } }}><Text>x</Text></div>'))
    expect(out).toContain('padding:4px')
    expect(out).not.toContain('nested')
  })
})

describe('escaping — text is data, not markup', () => {
  it('angle brackets and quotes in a literal survive as text', () => {
    const out = html(canvas('<Stack><Text>{"<script>alert(1)</script>"}</Text></Stack>'))
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })
})
