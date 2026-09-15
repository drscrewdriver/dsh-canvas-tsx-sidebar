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
import { ensureCanvasStyles } from './canvas/stylesheet'
import { baseName, isInsideWorkspace, isRemoteUrl, resolveMediaRef } from './canvas/paths'
import { fsReadText, isOutsideWorkspace, isUnavailable, mediaUrl, SidebarApiError } from './canvas/sidebar-api'
import type { Scope } from './canvas/sidebar-api'
import type { ExtractResult } from './canvas/ir'

/** The tab fields this component reads. */
export interface CanvasTabHandle {
  readonly id: string
  readonly path?: string
  /** Plugin-owned JSON blob persisted with the layout (`SidebarTab.meta`). */
  readonly meta?: unknown
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

/**
 * Which half of the preview/edit pair is showing.
 *
 * DSH's own code/preview toggle lives in the editor toolbar and is only
 * offered by viewers that implement it (markdown, html). A plugin cannot get
 * one for `.canvas.tsx`: `extOf()` matches on the last dot segment, so
 * `exts: ['canvas.tsx']` can never fire, `exts: ['tsx']` would claim every TSX
 * in the workspace, `detect` is only consulted for binary results, and there
 * is no per-path predicate or delegation in the match loop. So the toggle
 * lives here, in the one surface we do own.
 */
type Mode = 'preview' | 'code'

/** Read the persisted mode out of the tab's own meta blob. */
function readMode(meta: unknown): Mode {
  if (meta !== null && typeof meta === 'object' && (meta as { mode?: unknown }).mode === 'code') return 'code'
  return 'preview'
}

/** Install the document stylesheet, refreshing a stale copy left by HMR. */
function useDocumentStyles(): void {
  useEffect(() => {
    ensureCanvasStyles()
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

/** Segmented code/preview control: the container. */
const SEGMENT_STYLE = {
  display: 'inline-flex',
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
} as const

/**
 * One segment, idle.
 *
 * `fontWeight` is declared on BOTH segments on purpose: React warns (and the
 * style can go stale) when a rerender REMOVES a longhand that a `font`
 * shorthand in the same object still sets. Declaring it everywhere means the
 * property is only ever replaced, never removed.
 */
const SEGMENT_OFF_STYLE = {
  border: 'none',
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-tertiary)',
  padding: '3px 10px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 400,
  whiteSpace: 'nowrap',
} as const

/** One segment, active. */
const SEGMENT_ON_STYLE = {
  ...SEGMENT_OFF_STYLE,
  background: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
} as const

/** The raw-source view. */
const CODE_STYLE = {
  margin: 0,
  padding: '10px 12px',
  fontFamily: "'SF Mono', Monaco, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: 'pre',
  tabSize: 2,
  color: 'var(--dsw-alias-label-secondary)',
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
  /** The raw source, kept so the code view needs no second read. */
  const [source, setSource] = useState<string | undefined>(undefined)
  /** Code or preview; persisted in `tab.meta` so it survives a reload. */
  const [mode, setMode] = useState<Mode>(() => readMode(tab?.meta))

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
        setSource(file.content)
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
  const resolveImage = useCallback(
    (ref: string): string | undefined => {
      // A remote URL or data URI needs no host round-trip.
      if (isRemoteUrl(ref)) return ref
      // `resolveMediaRef` normalises while PRESERVING the root, so an
      // absolute reference stays absolute and cannot be smuggled past the
      // fence as a relative-looking `dir/C:/x.png`.
      const candidate = resolveMediaRef(ref, path ?? '')
      if (candidate === undefined) return undefined
      // The host's media route honours its own `workspaceFence` setting,
      // which is user-disableable — so we hold the line ourselves.
      return isInsideWorkspace(scope.cwd, candidate) ? mediaUrl(scope, candidate) : undefined
    },
    [scope, path],
  )

  // ── render ────────────────────────────────────────────────────────────
  /** Flip code/preview and persist the choice on the tab. */
  const switchMode = (next: Mode): void => {
    setMode(next)
    try {
      service?.updateTab(tab?.id ?? '', { meta: { mode: next } })
    } catch {
      // Same capability caveat as the path write-back: the view still works.
    }
  }

  // Only offered once there is something to flip between.
  const toggle =
    source === undefined
      ? null
      : createElement(
          'div',
          { style: SEGMENT_STYLE, role: 'group', 'aria-label': t('mode.label') },
          (['preview', 'code'] as const).map(option =>
            createElement(
              'button',
              {
                key: option,
                type: 'button',
                style: mode === option ? SEGMENT_ON_STYLE : SEGMENT_OFF_STYLE,
                'aria-pressed': mode === option,
                onClick: () => switchMode(option),
              },
              t(option === 'preview' ? 'mode.preview' : 'mode.code'),
            ),
          ),
        )

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
    toggle,
  )

  let body: ReactNode
  if (status === 'no-path') {
    body = createElement(Notice, { title: t('state.noPath'), detail: t('state.noPathHint') })
  } else if (status === 'loading') {
    body = createElement(Notice, { title: t('state.loading') })
  } else if (status === 'error') {
    body = createElement(Notice, { title: t('state.error'), detail: error })
  } else if (mode === 'code' && source !== undefined) {
    // Raw source, exactly as `fs.read` returned it — no re-encoding.
    body = createElement('pre', { style: CODE_STYLE }, source)
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
