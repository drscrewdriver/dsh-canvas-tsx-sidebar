/**
 * The skill's drift gate.
 *
 * `skills/writing-qoder-canvas/` tells a model which components to use and what
 * will happen to its props. That guidance is only worth anything while it
 * matches the renderer, and documentation drifts silently by nature — so the
 * two are wired together here:
 *
 * 1. the supported list in `references/components.md` must equal the tags the
 *    renderer actually handles;
 * 2. the "not supported" list must not name anything the renderer DOES handle;
 * 3. the worked example must render with zero degraded nodes — if the skill's
 *    own example cannot survive the parser, the skill is teaching something
 *    false.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { extractCanvas } from '../src/client/canvas/extract'
import { countNodes } from '../src/client/canvas/ir'
import { CanvasDocument } from '../src/client/canvas/render'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RENDERER = resolve(ROOT, 'src/client/canvas/render.tsx')
const SKILL = resolve(ROOT, 'skills/writing-qoder-canvas')
const COMPONENTS = resolve(SKILL, 'references/components.md')
const EXAMPLE = resolve(SKILL, 'examples/status-report.canvas.tsx')

/** Every tag the renderer's main switch handles, in source order. */
function rendererTags(): string[] {
  const source = readFileSync(RENDERER, 'utf8')
  return [...source.matchAll(/^\s*case '([^']*)':/gm)].map(m => m[1] as string)
}

/** The `<!-- supported:begin -->` block, one tag per line. */
function documentedTags(): string[] {
  const markdown = readFileSync(COMPONENTS, 'utf8')
  const start = markdown.indexOf('<!-- supported:begin')
  const end = markdown.indexOf('<!-- supported:end')
  expect(start, 'components.md has no supported:begin marker').toBeGreaterThanOrEqual(0)
  expect(end, 'components.md has no supported:end marker').toBeGreaterThan(start)
  return markdown
    .slice(start, end)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('<!--') && !line.startsWith('```'))
}

/** Backticked names listed under `## Not supported`. */
function documentedUnsupported(): string[] {
  const markdown = readFileSync(COMPONENTS, 'utf8')
  const heading = markdown.indexOf('## Not supported')
  expect(heading, 'components.md has no "## Not supported" section').toBeGreaterThanOrEqual(0)
  const section = markdown.slice(heading)
  const names = new Set<string>()
  for (const line of section.split('\n')) {
    // Bullet items and their indented continuations. The closing paragraph is
    // flush left, so this filter deliberately drops it — it names components
    // (`Table`, `Grid`, `Stat`) only to suggest alternatives.
    if (!/^\s*-/.test(line) && !/^\s+`/.test(line)) continue
    for (const m of line.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/g)) names.add(m[1] as string)
  }
  return [...names]
}

describe('the skill documents exactly what the renderer handles', () => {
  it('the supported list matches the renderer case-for-case', () => {
    expect(documentedTags()).toEqual(rendererTags())
  })

  it('the supported list is not empty and carries the headline components', () => {
    // A trivially-matching empty list would satisfy the test above.
    const tags = documentedTags()
    expect(tags.length).toBeGreaterThan(20)
    for (const required of ['ReportShell', 'Grid', 'Table', 'Stat', 'Timeline']) {
      expect(tags, `components.md stopped documenting ${required}`).toContain(required)
    }
  })

  it('nothing in the "not supported" list is actually supported', () => {
    const supported = new Set(rendererTags())
    const wronglyAvoided = documentedUnsupported().filter(name => supported.has(name))
    expect(wronglyAvoided, 'components.md tells the reader to avoid a supported component').toEqual([])
  })

  it('the "not supported" list is substantive', () => {
    // Guards the parsing above: if the extraction silently found nothing, the
    // test that depends on it would pass vacuously.
    const unsupported = documentedUnsupported()
    expect(unsupported.length).toBeGreaterThan(20)
    expect(unsupported).toContain('PieChart')
    expect(unsupported).toContain('CollapsibleSection')
  })
})

describe('the worked example survives the real parser', () => {
  const source = readFileSync(EXAMPLE, 'utf8')

  it('parses', () => {
    const result = extractCanvas(source)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    expect(countNodes(result.root).unsupported).toBe(0)
  })

  it('renders with no degraded node of any kind', () => {
    const result = extractCanvas(source)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    const markup = renderToStaticMarkup(CanvasDocument({ root: result.root }))
    // No fidelity notice...
    expect(markup).not.toContain('class="unsupported"')
    // ...and no component fell through to the unnamed-container case.
    expect(markup).not.toContain('unknown-component')
  })

  it('renders the content it claims to', () => {
    const result = extractCanvas(source)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    const markup = renderToStaticMarkup(CanvasDocument({ root: result.root }))

    // MetricsGrid headline
    expect(markup).toContain('新增云厂商')
    expect(markup).toContain('+1247')
    // Table: columns + rows, with `title` used as the heading
    expect(markup).toContain('<th class="th">厂商</th>')
    expect(markup).toContain('火山引擎')
    // rowTone, including the `undefined` slot that means "default"
    expect(markup).toContain('tr tr-success')
    expect(markup).toContain('tr tr-accent')
    // Timeline: three events, SDK field names
    expect(markup.match(/class="timeline-item"/g)).toHaveLength(3)
    // The escaped-brace prose came through as text rather than breaking the file
    expect(markup).toContain('相加（0 + {')
    expect(markup).toContain('会抛 TypeError')
  })

  it('the example is not accidentally picked up as a module the build compiles', () => {
    // It imports `qoder/canvas`, which does not resolve outside Qoder. If a
    // tsconfig ever widens its `include` to cover skills/, typecheck would fail
    // — this test documents that the example is a FIXTURE, read as text.
    for (const name of ['tsconfig.json', 'tsconfig.client.json', 'tsconfig.build.json']) {
      const config = readFileSync(resolve(ROOT, name), 'utf8')
      expect(config, `${name} must not include skills/`).not.toContain('skills')
    }
  })
})
