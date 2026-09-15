/**
 * The sidebar tab body.
 *
 * Scope: point it at ONE `.canvas.tsx` and it renders that file. It is not a
 * workspace browser — no scanning, no discovery.
 *
 * Why the path comes from the user rather than from a file viewer registration:
 * better-sidebar's `matchFileViewer` compares `extOf(path)`, which takes the
 * LAST dot segment, so `exts: ['canvas.tsx']` can never match a file named
 * `report.canvas.tsx` (its ext is `'tsx'`). Claiming `exts: ['tsx']` would
 * hijack every TSX file in the workspace. And `detect(path, head)` cannot help:
 * `matchFileViewer` is first called with no `head` at all, and `head` is only
 * supplied for `kind === 'binary'` results — never for a `.tsx`. There is also
 * no delegation API back to the built-in code viewer. The tab is therefore the
 * only seam that can own a canvas-specific view, and `tab.path` is how a
 * specific file reaches it.
 *
 * Two contracts from the plugin guide are honoured throughout:
 *
 * 1. **Height contract (§10).** The tab body mounts inside a full-height column
 *    flex host whose `.paneBody` is a definite-height BLOCK scroll container.
 *    The root declares `height: 100%` + `min-height: 0`, and the scrolling
 *    element is an inner div — not the root.
 * 2. **`visible` pause (§9).** Nothing is fetched until the tab is the active
 *    one; an in-flight request is aborted when it stops being visible.
 *
 * Chrome colours are `--dsw-alias-*` tokens so every skin follows. The document
 * subtree deliberately keeps its own paper palette — see `styles.ts`.
 */
import { useCallback, useEffect, useState } from 'react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { extractCanvas } from './canvas/extract'
import { CanvasDocument } from './canvas/render'
import { CANVAS_CSS } from './canvas/styles'
import { fsReadText, isOutsideWorkspace, isUnavailable, mediaUrl, SidebarApiError } from './canvas/sidebar-api'
import type { Scope } from './canvas/sidebar-api'
import type { ExtractResult } from './canvas/ir'

/** The tab fields this component reads. */
export interface CanvasTabHandle {
  readonly id: string
  readonly path?: string
}

/** The store write face this component uses — `BetterSidebarService`'s tab updater. */
export interface CanvasTabService {
  updateTab(tabId: string, patch: { title?: string; path?: string; meta?: unknown }): void
}

export interface CanvasReportTabProps {
  /** The DSH locale lookup, passed down from `apply`. */
  t: (key: string) => string
  /** The session this tab is scoped to. */
  scope: Scope
  /** The open tab — its `path` seeds the view the first time it mounts. */
  tab?: CanvasTabHandle
  /**
   * The sidebar service, for writing the picked path back onto the tab.
   *
   * This must be `ctx.betterSidebar` (the `BetterSidebarService`), NOT the
   * `store` in `TabComponentProps`: `SidebarStore` has `getSnapshot` and
   * `subscribeState` but no `updateTab` — that method lives on the service.
   */
  service?: CanvasTabService
  /** Whether the tab is the active one AND the panel is open (guide §9). */
  visible?: boolean
}

type Status = 'no-path' | 'loading' | 'ready' | 'error'

/** Stylesheet id, so re-mounting the tab cannot stack duplicate copies. */
const STYLE_ID = 'dsh-canvas-tsx-sidebar/styles'

/** Bare file name of any path spelling. */
function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

/** Directory part of a '/'-separated path. */
function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut)
}

/**
 * Resolve a `canvasImage()` reference against the canvas file's directory.
 * Normalises `.` and `..` so `./a/../b.png` and `b.png` agree.
 */
function resolveRef(dir: string, ref: string): string {
  const raw = ref.startsWith('/') ? ref.slice(1) : dir === '' ? ref : `${dir}/${ref}`
  const out: string[] = []
  for (const part of raw.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

/** Whether a path is written as absolute (Windows drive, UNC, or POSIX root). */
function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
}

/** Normalise for comparison only: slashes unified, no trailing slash, lowercase. */
function comparable(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * Our own workspace fence.
 *
 * better-sidebar's route blocks RELATIVE traversal (`../../x` -> 400) but not
 * absolute paths — a probe of this very deployment read `C:/Windows/win.ini`
 * and the profile's `package.json` straight through. The user types this path,
 * so we introduce nothing hostile; but a pasted-in path from elsewhere would
 * otherwise turn the tab into an arbitrary-file reader. Refusing to widen that
 * is cheap, so we do.
 */
export function isInsideWorkspace(cwd: string | undefined, path: string): boolean {
  if (!isAbsolutePath(path)) return true
  if (cwd === undefined || cwd === '') return false
  return comparable(path).startsWith(`${comparable(cwd)}/`)
}

/** Inject the document stylesheet once per page. */
function useDocumentStyles(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CANVAS_CSS
    document.head.appendChild(style)
    // Left in place on unmount: removing it would flash every other mounted
    // canvas tab, and the duplicate guard already makes re-adding a no-op.
  }, [])
}

const ROOT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 13,
} as const

const BAR_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderBottom: '1px solid var(--dsw-alias-border-secondary)',
  flexShrink: 0,
} as const

const SCROLL_STYLE = { flex: 1, minHeight: 0, overflow: 'auto' } as const

const INPUT_STYLE = {
  flex: 1,
  minWidth: 0,
  border: '1px solid var(--dsw-alias-border-secondary)',
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 6,
  padding: '3px 8px',
  font: 'inherit',
  fontSize: 12,
} as const

const BUTTON_STYLE = {
  border: '1px solid var(--dsw-alias-border-secondary)',
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 6,
  padding: '3px 10px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  whiteSpace: 'nowrap',
} as const

/** Centred message block used by every non-document state. */
function Notice(props: { title: string; detail?: ReactNode }): ReactNode {
  return createElement(
    'div',
    {
      style: {
        margin: '0 auto',
        padding: 24,
        maxWidth: 460,
        textAlign: 'center',
        color: 'var(--dsw-alias-label-tertiary)',
        lineHeight: 1.7,
        fontSize: 12,
      },
    },
    createElement('div', { style: { marginBottom: 6, color: 'var(--dsw-alias-label-secondary)' } }, props.title),
    props.detail === undefined ? null : createElement('div', null, props.detail),
  )
}

export function CanvasReportTab(props: CanvasReportTabProps): ReactNode {
  const { t, scope, tab, service, visible = true } = props
  useDocumentStyles()

  const seeded = tab?.path
  /** What the user is typing. */
  const [draft, setDraft] = useState<string>(seeded ?? '')
  /** What we are actually rendering — set only on a validated submit. */
  const [path, setPath] = useState<string | undefined>(seeded)
  const [status, setStatus] = useState<Status>(seeded === undefined ? 'no-path' : 'loading')
  const [parsed, setParsed] = useState<ExtractResult | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  // Adopt a path that arrives from outside (another plugin opening this tab
  // with a seed, or a restored layout) without fighting the user's typing.
  useEffect(() => {
    if (seeded === undefined || seeded === path) return
    setDraft(seeded)
    setPath(seeded)
  }, [seeded, path])

  // ── load + parse ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || path === undefined) return
    const controller = new AbortController()

    setStatus('loading')
    setError(undefined)

    fsReadText(scope, path, controller.signal)
      .then(file => {
        if (controller.signal.aborted) return
        setParsed(extractCanvas(file.content))
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setStatus('error')
        setError(describe(cause))
      })

    return () => controller.abort()
  }, [visible, scope, path])

  // ── submit ────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    const next = draft.trim()
    if (next === '') {
      setStatus('no-path')
      setPath(undefined)
      return
    }
    if (!isInsideWorkspace(scope.cwd, next)) {
      setStatus('error')
      setError(t('error.outsideWorkspace'))
      return
    }
    setPath(next)
    // Stick the path to the tab: it is persisted with the layout, so the tab
    // reopens on the same file instead of an empty prompt.
    try {
      service?.updateTab(tab?.id ?? '', { path: next, title: baseName(next) })
    } catch {
      // A host without the `updateTab` capability is fine — the view still works
      // for this mount, it just will not survive a reload.
    }
  }, [draft, scope.cwd, service, tab, t])

  // ── image seam ────────────────────────────────────────────────────────
  const baseDir = path === undefined ? '' : dirOf(path.replace(/\\/g, '/'))
  const resolveImage = useCallback(
    (ref: string): string | undefined => {
      // A literal URL or data URI needs no host round-trip.
      if (ref.startsWith('data:') || /^https?:\/\//i.test(ref)) return ref

      // An absolute reference must be checked BEFORE joining: `resolveRef`
      // would otherwise mangle `C:/x.png` into the harmless-looking relative
      // `try/C:/x.png`, sailing straight past the fence.
      if (isAbsolutePath(ref)) {
        return isInsideWorkspace(scope.cwd, ref) ? mediaUrl(scope, ref) : undefined
      }

      const joined = resolveRef(baseDir, ref)
      // `resolveRef` collapses `..`, so anything still climbing after that is
      // an escape attempt; the host would 400 it, but the placeholder is a
      // better answer than a broken image.
      if (joined.startsWith('..')) return undefined
      return isInsideWorkspace(scope.cwd, joined) ? mediaUrl(scope, joined) : undefined
    },
    [scope, baseDir],
  )

  // ── render ────────────────────────────────────────────────────────────
  const bar = createElement(
    'div',
    { style: BAR_STYLE },
    createElement('input', {
      style: INPUT_STYLE,
      value: draft,
      spellCheck: false,
      placeholder: t('input.placeholder'),
      'aria-label': t('input.placeholder'),
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
      onKeyDown: (event: { key: string }) => {
        if (event.key === 'Enter') submit()
      },
    }),
    createElement('button', { type: 'button', style: BUTTON_STYLE, onClick: submit }, t('action.open')),
  )

  let body: ReactNode
  if (status === 'no-path') {
    body = createElement(Notice, { title: t('state.noPath'), detail: t('state.noPathHint') })
  } else if (status === 'loading') {
    body = createElement(Notice, { title: t('state.loading') })
  } else if (status === 'error') {
    body = createElement(Notice, { title: t('state.error'), detail: error })
  } else if (parsed !== undefined && !parsed.ok) {
    // A parse failure is a per-file result, not a wire failure: say which.
    body = createElement(Notice, {
      title: t('state.parseFailed'),
      detail: `${parsed.error.code}: ${parsed.error.message}`,
    })
  } else if (parsed !== undefined && parsed.ok) {
    body = createElement(CanvasDocument, { root: parsed.root, options: { resolveImage } })
  } else {
    body = createElement(Notice, { title: t('state.loading') })
  }

  return createElement(
    'div',
    { style: ROOT_STYLE, 'data-dsh-canvas-tsx': 'root' },
    bar,
    createElement('div', { style: SCROLL_STYLE }, body),
  )
}

/** Turn a thrown value into something worth showing a user. */
function describe(cause: unknown): string {
  if (isUnavailable(cause)) return 'better-sidebar is not serving the fs API.'
  if (isOutsideWorkspace(cause)) return 'The path is outside the session workspace.'
  if (cause instanceof SidebarApiError) return `${cause.code}: ${cause.message}`
  return cause instanceof Error ? cause.message : String(cause)
}
