/**
 * File viewer: renders `.canvas.tsx` as a live document in the sidebar's
 * native editor surface, with a code/preview toggle.
 *
 * Registration: `apply()` registers this viewer for `exts: ['tsx']` at a
 * priority above the catch-all `code` viewer. For a `.canvas.tsx` file the
 * user gets a rendered document with a toggle; for other `.tsx` files they
 * get a monospace source view. Both can be disabled in the Side card
 * settings page without restarting.
 *
 * Why we do our own `fsRead` instead of piggy-backing on the host's read:
 * `FileViewerProps` does not carry the file content — the host reads it and
 * passes `mode`/`setMode` instead. The second round-trip is acceptable
 * because the host caches the read.
 */
import { createElement, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { extractCanvas } from './extract'
import { CanvasDocument } from './render'
import { CANVAS_CSS } from './styles'
import { isInsideWorkspace, isRemoteUrl, resolveMediaRef } from './paths'
import { fsReadText, isUnavailable, mediaUrl, SidebarApiError } from './sidebar-api'
import type { Scope } from './sidebar-api'

/** Minimal subset of `FileViewerProps` the component actually uses. */
export interface ViewerProps {
  readonly scope: Scope
  readonly path: string
  readonly title?: string
}

/** Viewer id — also the settings toggle key (`viewersEnabled[id]`). */
export const VIEWER_ID = 'dsh-canvas-tsx:viewer'

/** Stylesheet id — must match the tab's so they share one `<style>`. */
const STYLE_ID = 'dsh-canvas-tsx-sidebar/styles'

type ViewMode = 'preview' | 'code'

/** Bare file name of any path spelling. */
function baseName(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

// ---------------------------------------------------------------------------
// styles (scoped, no token coupling — see styles.ts comment)
// ---------------------------------------------------------------------------

const ROOT_STYLE = {
  height: '100%',
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
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

const SEGMENT_STYLE = {
  display: 'inline-flex',
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
} as const

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

const SEGMENT_ON_STYLE = {
  ...SEGMENT_OFF_STYLE,
  background: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
} as const

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

const NOTICE_STYLE = {
  margin: 'auto',
  padding: 24,
  textAlign: 'center',
  color: 'var(--dsw-alias-label-tertiary)',
  lineHeight: 1.7,
  fontSize: 12,
} as const

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

/**
 * File viewer for `.canvas.tsx` files.
 *
 * The viewer checks the source: if `extractCanvas` succeeds, the user gets a
 * rendered document and a code/preview toggle. If it fails (non-canvas `.tsx`
 * or a parse error), the raw source is shown in a monospace block. This is an
 * honest degradation — the source is always available — and the user can
 * disable the entire viewer in settings if the plain-text fallback is too
 * disruptive for non-canvas files.
 */
export function CanvasFileViewer(props: ViewerProps): ReactNode {
  const { scope, path } = props

  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [source, setSource] = useState<string>('')
  const [parsed, setParsed] = useState<ReturnType<typeof extractCanvas> | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  // Inject the canvas stylesheet (idempotent — the tab may already have done it).
  useEffect(() => {
    if (document.getElementById(STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CANVAS_CSS
    document.head.appendChild(style)
  }, [])

  // Fetch the source on mount and on path change.
  useEffect(() => {
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
        setError(
          isUnavailable(cause)
            ? 'better-sidebar is not serving the fs API.'
            : cause instanceof SidebarApiError
              ? `${cause.code}: ${cause.message}`
              : cause instanceof Error
                ? cause.message
                : String(cause),
        )
      })
    return () => controller.abort()
  }, [scope, path])

  const isCanvas = parsed !== undefined && parsed.ok

  const resolveImage = useCallback(
    (ref: string): string | undefined => {
      if (isRemoteUrl(ref)) return ref
      const candidate = resolveMediaRef(ref, path)
      if (candidate === undefined) return undefined
      return isInsideWorkspace(scope.cwd, candidate) ? mediaUrl(scope, candidate) : undefined
    },
    [scope, path],
  )

  // ── toolbar ─────────────────────────────────────────────────────────
  const toggle =
    !isCanvas || source === ''
      ? null
      : createElement(
          'div',
          { style: SEGMENT_STYLE, role: 'group', 'aria-label': 'Display mode' },
          (['preview', 'code'] as const).map(mode =>
            createElement(
              'button',
              {
                key: mode,
                type: 'button',
                style: viewMode === mode ? SEGMENT_ON_STYLE : SEGMENT_OFF_STYLE,
                'aria-pressed': viewMode === mode,
                onClick: () => setViewMode(mode),
              },
              mode === 'preview' ? '预览' : '代码',
            ),
          ),
        )

  const bar = createElement(
    'div',
    { style: BAR_STYLE },
    createElement(
      'span',
      { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      baseName(path),
    ),
    toggle,
  )

  // ── body ────────────────────────────────────────────────────────────
  let body: ReactNode
  if (status === 'loading') {
    body = createElement('div', { style: NOTICE_STYLE }, '读取中…')
  } else if (status === 'error') {
    body = createElement('div', { style: NOTICE_STYLE }, createElement('div', { style: { fontWeight: 600, marginBottom: 6 } }, '读取失败'), error)
  } else if (parsed !== undefined && !parsed.ok) {
    // Parse failed: show the source — the user can at least inspect it.
    body = createElement('pre', { style: CODE_STYLE }, source)
  } else if (parsed?.ok && viewMode === 'preview') {
    body = createElement(CanvasDocument, { root: parsed.root, options: { resolveImage } })
  } else {
    // Non-canvas, or code mode: raw source.
    body = createElement('pre', { style: CODE_STYLE }, source)
  }

  return createElement('div', { style: ROOT_STYLE }, bar, createElement('div', { style: SCROLL_STYLE }, body))
}
