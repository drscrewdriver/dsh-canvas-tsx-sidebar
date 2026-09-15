/**
 * File viewer behaviour.
 *
 * The viewer is the "takeover" path: register a viewer for `.tsx`, and
 * the file opens in our surface instead of the built-in code editor.
 * For a `.canvas.tsx` file the user gets a rendered document with a
 * code/preview toggle; for other `.tsx` files the raw source is shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { CanvasFileViewer } from '../src/client/canvas/canvas-viewer'

const CANVAS_SOURCE = `import { H1, Stack, canvasImage } from 'qoder/canvas'

const shot = canvasImage('./shot.png')

export default function Report() {
  return (
    <Stack>
      <H1>Hello Canvas</H1>
      <img src={shot} alt="screenshot" />
    </Stack>
  )
}
`

const REGULAR_TSX = `export const x = 1
`

function reply(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}
function ok(value: unknown): Response { return reply({ ok: true, value }) }
function fail(code: string, message: string, status = 200): Response {
  return reply({ ok: false, error: { code, message } }, status)
}

function wire(routes: Record<string, () => Response>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body?: string }) => {
    const method = String(url).replace('/sidebar/api/', '')
    const handler = routes[method]
    return handler === undefined ? fail('not-found', 'no route', 404) : handler()
  }))
}

const SCOPE = { sessionId: 's1', cwd: 'E:\\ws' }

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

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

async function mountViewer(path: string, content: string): Promise<void> {
  wire({ 'fs.read': () => ok({ kind: 'text', content, truncated: false }) })
  await act(async () => {
    root.render(createElement(CanvasFileViewer, { scope: SCOPE, path }))
  })
  await flush()
}

/** Click a button by its text label. */
async function clickBtn(label: string): Promise<void> {
  const btn = [...container.querySelectorAll('button')].find(b => b.textContent === label)
  if (btn === undefined) throw new Error(`no button "${label}"`)
  await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await flush()
}

describe('canvas file → live document with toggle', () => {
  it('renders the parsed document', async () => {
    await mountViewer('try/r.canvas.tsx', CANVAS_SOURCE)
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
    expect(container.querySelector('.report-shell')).not.toBeNull()
    expect(container.querySelector('h1.h1')?.textContent).toBe('Hello Canvas')
  })

  it('shows a toggle between preview and code', async () => {
    await mountViewer('try/r.canvas.tsx', CANVAS_SOURCE)
    expect(container.textContent).toContain('预览')
    expect(container.textContent).toContain('代码')
  })

  it('switching to code shows the raw source', async () => {
    await mountViewer('try/r.canvas.tsx', CANVAS_SOURCE)
    await clickBtn('代码')
    expect(container.querySelector('pre')?.textContent).toContain("canvasImage('./shot.png')")
    expect(container.querySelector('.dsh-canvas-doc')).toBeNull()
  })

  it('switching back to preview re-renders the document', async () => {
    await mountViewer('try/r.canvas.tsx', CANVAS_SOURCE)
    await clickBtn('代码')
    await clickBtn('预览')
    expect(container.querySelector('.dsh-canvas-doc')).not.toBeNull()
    expect(container.querySelector('pre')).toBeNull()
  })
})

describe('non-canvas file → source only, no toggle', () => {
  it('shows raw source without a toggle', async () => {
    // `export const x = 1` has no default export, so extractCanvas fails →
    // the viewer falls back to raw source.
    await mountViewer('src/App.tsx', REGULAR_TSX)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('export const x = 1')
    expect(container.textContent).not.toContain('预览')
    expect(container.textContent).not.toContain('代码')
  })
})

describe('error states', () => {
  it('shows error when wire fails', async () => {
    wire({})
    await act(async () => {
      root.render(createElement(CanvasFileViewer, { scope: SCOPE, path: 'x.tsx' }))
    })
    await flush()
    expect(container.textContent).toContain('读取失败')
  })

  it('shows source on parse failure', async () => {
    await mountViewer('bad.tsx', 'export const nope = 1\n')
    expect(container.querySelector('pre')?.textContent).toContain('export const nope = 1')
  })
})
