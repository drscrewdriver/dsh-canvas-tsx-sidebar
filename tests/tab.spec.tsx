/**
 * Sidebar tab behaviour.
 *
 * The tab renders ONE file that the user names. These tests pin the states, the
 * two integration contracts that break silently (the `visible` pause and the
 * image seam), and — most importantly — the fence: an absolute path outside the
 * session workspace must be refused by US, because the host route does not
 * refuse it.
 *
 * The canvas fixture is deliberately semicolon-less, so this file also
 * exercises the ASI fix end-to-end (a semicolon-less source used to lose every
 * `canvasImage()` binding).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { CanvasReportTab } from '../src/client/CanvasReportTab'
import { isInsideWorkspace } from '../src/client/canvas/paths'

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

/** One recorded request. */
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

/** A workspace-relative read that succeeds. */
const READ_OK = { 'fs.read': () => ok({ kind: 'text', content: CANVAS_SOURCE, truncated: false }) }

const SCOPE = { sessionId: 'sess-1', cwd: 'E:\\ws' }

let container: HTMLDivElement
let root: Root
let updates: Array<{ tabId: string; patch: Record<string, unknown> }>

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  updates = []
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** Settle the promise chain a fetch kicks off. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

interface MountOptions {
  path?: string
  visible?: boolean
}

/** Mount the tab and let every pending promise settle. */
async function mount(options: MountOptions = {}): Promise<void> {
  await act(async () => {
    root.render(
      createElement(CanvasReportTab, {
        t: (key: string) => key,
        scope: SCOPE,
        tab: options.path === undefined ? { id: 'tab-1' } : { id: 'tab-1', path: options.path },
        service: {
          updateTab: (tabId: string, patch: Record<string, unknown>) => updates.push({ tabId, patch }),
        },
        visible: options.visible ?? true,
      }),
    )
  })
  await flush()
}

/** Type into the path box the way a browser does, then press the button. */
async function typePath(value: string): Promise<void> {
  const input = container.querySelector('input')
  if (input === null) throw new Error('no path input rendered')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await flush()
}

describe('no path yet — the tab waits for one', () => {
  it('prompts instead of scanning', async () => {
    const calls = wire(READ_OK)
    await mount()
    expect(container.textContent).toContain('state.noPath')
    expect(container.textContent).toContain('state.noPathHint')
    // The point of this design: opening the tab touches nothing.
    expect(calls).toEqual([])
  })

  it('renders a path box', async () => {
    wire(READ_OK)
    await mount()
    expect(container.querySelector('input')).not.toBeNull()
  })
})

describe('a named path renders', () => {
  it('renders the document, not a placeholder', async () => {
    wire(READ_OK)
    await mount({ path: 'try/report.canvas.tsx' })
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
    expect(container.querySelector('.report-shell')).not.toBeNull()
    expect(container.querySelector('h1.h1')?.textContent).toBe('Hello Canvas')
    expect(container.textContent).toContain('body text')
  })

  it('reads only that file, scoped to the session', async () => {
    const calls = wire(READ_OK)
    await mount({ path: 'try/report.canvas.tsx' })
    expect(calls.map(c => c.method)).toEqual(['fs.read'])
    expect(calls[0]?.payload).toMatchObject({
      sessionId: 'sess-1',
      cwd: 'E:\\ws',
      path: 'try/report.canvas.tsx',
    })
  })

  it('resolves the screenshot to the media route, not base64 and not a raw path', async () => {
    wire(READ_OK)
    await mount({ path: 'try/report.canvas.tsx' })
    const img = container.querySelector('img')
    const src = img?.getAttribute('src') ?? ''
    // Origin-absolute, mirroring better-sidebar's own mediaUrl.
    expect(src).toContain('/sidebar/file?')
    expect(decodeURIComponent(src)).toContain('path=try/shot.png')
    expect(src).not.toContain('base64')
  })

  it('injects the document stylesheet exactly once', async () => {
    wire(READ_OK)
    await mount({ path: 'try/report.canvas.tsx' })
    expect(document.querySelectorAll('#dsh-canvas-tsx-sidebar\\/styles')).toHaveLength(1)
  })
})

describe('typing a path opens it and sticks it to the tab', () => {
  it('loads the typed file', async () => {
    const calls = wire(READ_OK)
    await mount()
    await typePath('try/report.canvas.tsx')
    expect(calls.map(c => c.method)).toEqual(['fs.read'])
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
  })

  it('persists the path so the tab reopens on the same file', async () => {
    wire(READ_OK)
    await mount()
    await typePath('try/report.canvas.tsx')
    expect(updates).toEqual([
      { tabId: 'tab-1', patch: { path: 'try/report.canvas.tsx', title: 'report.canvas.tsx' } },
    ])
  })
})

describe('fence — we refuse what the host would have allowed', () => {
  it('accepts a relative path', () => {
    expect(isInsideWorkspace('E:\\ws', 'try/a.canvas.tsx')).toBe(true)
  })

  it('accepts an absolute path inside the workspace, in any spelling', () => {
    expect(isInsideWorkspace('E:\\ws', 'E:\\ws\\try\\a.canvas.tsx')).toBe(true)
    expect(isInsideWorkspace('E:\\ws', 'e:/ws/try/a.canvas.tsx')).toBe(true)
  })

  it('refuses an absolute path outside the workspace', () => {
    // The deployed host route answers this one with file contents.
    expect(isInsideWorkspace('E:\\ws', 'C:/Windows/win.ini')).toBe(false)
    expect(isInsideWorkspace('E:\\ws', 'E:\\other\\a.canvas.tsx')).toBe(false)
  })

  it('refuses an absolute path when the cwd is unknown', () => {
    expect(isInsideWorkspace(undefined, 'E:\\ws\\a.canvas.tsx')).toBe(false)
  })

  it('never reads anything when the typed path is outside the workspace', async () => {
    const calls = wire(READ_OK)
    await mount()
    await typePath('C:/Windows/win.ini')
    expect(calls).toEqual([])
    expect(container.textContent).toContain('error.outsideWorkspace')
  })

  it('does not build a media URL for an absolute image reference', async () => {
    wire({
      'fs.read': () =>
        ok({
          kind: 'text',
          content: `import { Stack, canvasImage } from 'qoder/canvas'\nconst s = canvasImage('C:/secrets/x.png')\nexport default function R() {\n  return (\n    <Stack>\n      <img src={s} alt="s" />\n    </Stack>\n  )\n}\n`,
          truncated: false,
        }),
    })
    await mount({ path: 'try/a.canvas.tsx' })
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('未找到')
  })
})

describe('error states', () => {
  it('says so when better-sidebar is not serving the fs API', async () => {
    wire({})
    await mount({ path: 'a.canvas.tsx' })
    expect(container.textContent).toContain('state.error')
    expect(container.textContent).toContain('better-sidebar is not serving the fs API.')
  })

  it('translates the host fence into plain language', async () => {
    wire({ 'fs.read': () => fail('forbidden', 'path "x" is outside workspace') })
    await mount({ path: 'x.canvas.tsx' })
    expect(container.textContent).toContain('outside the session workspace')
  })

  it('reports a parse failure as a per-file result', async () => {
    wire({ 'fs.read': () => ok({ kind: 'text', content: 'export const nope = 1\n', truncated: false }) })
    await mount({ path: 'broken.canvas.tsx' })
    expect(container.textContent).toContain('state.parseFailed')
    expect(container.textContent).toContain('no-default-export')
  })

  it('refuses a binary file rather than rendering garbage', async () => {
    wire({ 'fs.read': () => ok({ kind: 'binary', size: 10, head: '', truncated: false }) })
    await mount({ path: 'img.canvas.tsx' })
    expect(container.textContent).toContain('not a text file')
  })
})

describe('visible contract — an inactive tab must not hit the wire', () => {
  it('fetches nothing while hidden, then loads on becoming visible', async () => {
    const calls = wire(READ_OK)
    await mount({ path: 'try/report.canvas.tsx', visible: false })
    expect(calls).toEqual([])

    await act(async () => {
      root.render(
        createElement(CanvasReportTab, {
          t: (key: string) => key,
          scope: SCOPE,
          tab: { id: 'tab-1', path: 'try/report.canvas.tsx' },
          visible: true,
        }),
      )
    })
    await flush()
    expect(calls.map(c => c.method)).toEqual(['fs.read'])
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
  })
})
