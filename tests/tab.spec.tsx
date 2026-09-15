/**
 * Sidebar tab behaviour.
 *
 * These drive the real component against a faked `/sidebar/api` wire, so they
 * pin the four states AND the two integration contracts that are easy to break
 * silently:
 *
 * - the tab must not touch the wire while it is not the visible one;
 * - a screenshot must resolve to the sidebar's media route, never to a base64
 *   blob and never to a raw filesystem path.
 *
 * The canvas source below deliberately omits semicolons, so this file also
 * exercises the ASI fix end-to-end (a semicolon-less file used to lose every
 * `canvasImage()` binding).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { CanvasReportTab } from '../src/client/CanvasReportTab'

/** A semicolon-less canvas file with one screenshot. */
const CANVAS_SOURCE = `import { H1, Stack, Text, canvasImage } from 'qoder/canvas'

const shot = canvasImage('./shot.png')

export default function Report() {
  return (
    <Stack>
      <H1>Hello Canvas</H1>
      <Text>body text</Text>
      <img src={shot} alt="screenshot" />
    </Stack>
  )
}
`

/** Build a Response-shaped object without touching the network. */
function reply(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

/** Envelope the host writes on success. */
function ok(value: unknown): Response {
  return reply({ ok: true, value })
}

/** Envelope the host writes on failure. */
function fail(code: string, message: string, status = 200): Response {
  return reply({ ok: false, error: { code, message } }, status)
}

/** Recorded requests, for asserting on payloads. */
interface Call {
  method: string
  payload: Record<string, unknown>
}

/**
 * Install a fake `/sidebar/api` wire.
 * @returns the recorded calls, newest last.
 */
function wire(routes: Record<string, () => Response>): Call[] {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body?: string }) => {
      const method = String(url).replace('/sidebar/api/', '')
      calls.push({ method, payload: JSON.parse(init.body ?? '{}') as Record<string, unknown> })
      const handler = routes[method]
      return handler === undefined
        ? fail('not-found', `no route for ${method}`, 404)
        : handler()
    }),
  )
  return calls
}

const SCOPE = { sessionId: 'sess-1', cwd: '/ws' }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** Mount the tab and let every pending promise settle. */
async function mount(visible = true): Promise<void> {
  await act(async () => {
    root.render(createElement(CanvasReportTab, { t: (key: string) => key, scope: SCOPE, visible }))
  })
  // Two turns: the search resolves, then the read it triggers resolves.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('empty — discovery found nothing', () => {
  it('explains the miss and offers a reload', async () => {
    wire({ 'fs.search': () => ok({ matches: [], truncated: false }) })
    await mount()
    expect(container.textContent).toContain('state.empty')
    expect(container.textContent).toContain('state.emptyHint')
    expect(container.querySelector('button')?.textContent).toBe('action.reload')
  })

  it('ignores matches that are not .canvas.tsx', async () => {
    wire({ 'fs.search': () => ok({ matches: ['a.canvas.tsx.bak', 'b.tsx'] }) })
    await mount()
    expect(container.textContent).toContain('state.empty')
  })
})

describe('ready — a parsed document', () => {
  const routes = {
    'fs.search': () => ok({ matches: ['try/report.canvas.tsx'], truncated: false }),
    'fs.read': () => ok({ kind: 'text', content: CANVAS_SOURCE, truncated: false }),
  }

  it('renders the document, not a placeholder', async () => {
    wire(routes)
    await mount()
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
    expect(container.querySelector('.report-shell')).not.toBeNull()
    expect(container.querySelector('h1.h1')?.textContent).toBe('Hello Canvas')
    expect(container.textContent).toContain('body text')
  })

  it('reads the file through the workspace-fenced route, scoped to the session', async () => {
    const calls = wire(routes)
    await mount()
    expect(calls.map(c => c.method)).toEqual(['fs.search', 'fs.read'])
    expect(calls[0]?.payload).toMatchObject({ sessionId: 'sess-1', cwd: '/ws', query: '.canvas.tsx' })
    expect(calls[1]?.payload).toMatchObject({ sessionId: 'sess-1', path: 'try/report.canvas.tsx' })
  })

  it('resolves the screenshot to the media route, not base64 and not a raw path', async () => {
    wire(routes)
    await mount()
    const img = container.querySelector('img')
    const src = img?.getAttribute('src') ?? ''
    expect(src.startsWith('/sidebar/file?')).toBe(true)
    // `try/report.canvas.tsx` + `./shot.png` -> `try/shot.png`
    expect(decodeURIComponent(src)).toContain('path=try/shot.png')
    expect(src).not.toContain('base64')
    expect(img?.getAttribute('alt')).toBe('screenshot')
  })

  it('injects the document stylesheet exactly once', async () => {
    wire(routes)
    await mount()
    expect(document.querySelectorAll('#dsh-canvas-tsx-sidebar\\/styles')).toHaveLength(1)
  })
})

describe('error — the wire refused us', () => {
  it('says so when better-sidebar is not serving the fs API', async () => {
    wire({})
    await mount()
    expect(container.textContent).toContain('state.error')
    expect(container.textContent).toContain('better-sidebar is not serving the fs API.')
  })

  it('translates the workspace fence into plain language', async () => {
    wire({
      'fs.search': () => ok({ matches: ['x.canvas.tsx'], truncated: false }),
      'fs.read': () => fail('forbidden', 'path "x.canvas.tsx" is outside workspace'),
    })
    await mount()
    expect(container.textContent).toContain('outside the session workspace')
  })

  it('reports a parse failure as a per-file result', async () => {
    wire({
      'fs.search': () => ok({ matches: ['broken.canvas.tsx'], truncated: false }),
      'fs.read': () => ok({ kind: 'text', content: 'export const nope = 1\n', truncated: false }),
    })
    await mount()
    expect(container.textContent).toContain('state.parseFailed')
    expect(container.textContent).toContain('no-default-export')
  })

  it('refuses a binary file rather than rendering garbage', async () => {
    wire({
      'fs.search': () => ok({ matches: ['img.canvas.tsx'], truncated: false }),
      'fs.read': () => ok({ kind: 'binary', size: 10, head: '', truncated: false }),
    })
    await mount()
    expect(container.textContent).toContain('not a text file')
  })
})

describe('visible contract — an inactive tab must not hit the wire', () => {
  it('fetches nothing while hidden', async () => {
    const calls = wire({ 'fs.search': () => ok({ matches: [], truncated: false }) })
    await mount(false)
    expect(calls).toEqual([])
  })

  it('fetches nothing when hidden, then loads on becoming visible', async () => {
    const calls = wire({
      'fs.search': () => ok({ matches: ['a.canvas.tsx'], truncated: false }),
      'fs.read': () => ok({ kind: 'text', content: CANVAS_SOURCE, truncated: false }),
    })
    await mount(false)
    expect(calls).toEqual([])

    await act(async () => {
      root.render(createElement(CanvasReportTab, { t: (key: string) => key, scope: SCOPE, visible: true }))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(calls.map(c => c.method)).toEqual(['fs.search', 'fs.read'])
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
  })
})

describe('picker — shown only when there is a choice', () => {
  it('stays out of the way for a single file', async () => {
    wire({
      'fs.search': () => ok({ matches: ['only.canvas.tsx'], truncated: false }),
      'fs.read': () => ok({ kind: 'text', content: CANVAS_SOURCE, truncated: false }),
    })
    await mount()
    expect(container.querySelector('select')).toBeNull()
  })

  it('lists every candidate in name order when there are several', async () => {
    wire({
      'fs.search': () => ok({ matches: ['z.canvas.tsx', 'a.canvas.tsx'], truncated: false }),
      'fs.read': () => ok({ kind: 'text', content: CANVAS_SOURCE, truncated: false }),
    })
    await mount()
    const options = [...container.querySelectorAll('option')].map(o => o.textContent)
    expect(options).toEqual(['a.canvas.tsx', 'z.canvas.tsx'])
  })
})
