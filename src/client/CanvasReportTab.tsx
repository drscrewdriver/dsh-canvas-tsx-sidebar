/**
 * The sidebar tab body.
 *
 * Four states, in the order a user meets them:
 *
 *   loading -> reading the workspace file list through the sidebar's fs routes
 *   empty   -> no `*.canvas.tsx` under the session cwd
 *   error   -> the wire failed (unavailable / outside-workspace / parse)
 *   ready   -> a parsed document, with a picker when there is more than one
 *
 * Two contracts from the plugin guide are honoured throughout:
 *
 * 1. **Height contract (§10).** The tab body is mounted inside a full-height
 *    column flex host whose `.paneBody` is a definite-height BLOCK scroll
 *    container. The root therefore declares `height: 100%` + `min-height: 0`,
 *    and the scrolling element is an inner div — not the root.
 * 2. **`visible` pause (§9).** Nothing is fetched until the tab is the active
 *    one; an in-flight request is aborted when it stops being visible.
 *
 * Chrome colours are `--dsw-alias-*` tokens so every skin follows. The
 * document subtree deliberately keeps its own paper palette — see `styles.ts`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { extractCanvas } from './canvas/extract'
import { CanvasDocument } from './canvas/render'
import { CANVAS_CSS } from './canvas/styles'
import { fsReadText, fsSearch, isOutsideWorkspace, isUnavailable, mediaUrl, SidebarApiError } from './canvas/sidebar-api'
import type { Scope } from './canvas/sidebar-api'
import type { ExtractResult } from './canvas/ir'

export interface CanvasReportTabProps {
  /** The DSH locale service lookup, passed down from `apply`. */
  t: (key: string) => string
  /** The session this tab is scoped to. */
  scope: Scope
  /** Whether the tab is the active one AND the panel is open (guide §9). */
  visible?: boolean
}

/** One row of the file picker. */
interface Candidate {
  /** cwd-relative, '/'-separated path as the host reports it. */
  path: string
  name: string
}

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

/** Stylesheet id, so re-mounting the tab cannot stack duplicate copies. */
const STYLE_ID = 'dsh-canvas-tsx-sidebar/styles'

/** Directory part of a cwd-relative '/'-separated path. */
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

/** Inject the document stylesheet once per page. */
function useDocumentStyles(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CANVAS_CSS
    document.head.appendChild(style)
    // Left in place on unmount: removing it would flash every other mounted
    // canvas tab, and a duplicate guard already makes re-adding a no-op.
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
  gap: 8,
  padding: '8px 12px',
  borderBottom: '1px solid var(--dsw-alias-border-secondary)',
  flexShrink: 0,
} as const

const SCROLL_STYLE = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
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
} as const

const SELECT_STYLE = {
  flex: 1,
  minWidth: 0,
  border: '1px solid var(--dsw-alias-border-secondary)',
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 6,
  padding: '3px 6px',
  font: 'inherit',
  fontSize: 12,
} as const

/** Centred message block used by every non-ready state. */
function Notice(props: { title: string; detail?: string; action?: ReactNode }): ReactNode {
  return createElement(
    'div',
    {
      style: {
        margin: '0 auto',
        padding: 24,
        maxWidth: 420,
        textAlign: 'center',
        color: 'var(--dsw-alias-label-tertiary)',
        lineHeight: 1.6,
        fontSize: 12,
      },
    },
    createElement('div', { style: { marginBottom: 6, color: 'var(--dsw-alias-label-secondary)' } }, props.title),
    props.detail === undefined ? null : createElement('div', null, props.detail),
    props.action === undefined ? null : createElement('div', { style: { marginTop: 12 } }, props.action),
  )
}

export function CanvasReportTab(props: CanvasReportTabProps): ReactNode {
  const { t, scope, visible = true } = props
  useDocumentStyles()

  const [status, setStatus] = useState<Status>('idle')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [parsed, setParsed] = useState<ExtractResult | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  /** Bumped to re-run discovery on demand (the refresh button). */
  const [nonce, setNonce] = useState(0)

  /** Guards against a resolved fetch for a file the user already left. */
  const selectedRef = useRef<string | undefined>(undefined)
  selectedRef.current = selected

  // ── discovery ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()

    setStatus('loading')
    setError(undefined)

    fsSearch(scope, '.canvas.tsx', controller.signal)
      .then(matches => {
        if (controller.signal.aborted) return
        const found = matches
          .filter(path => path.endsWith('.canvas.tsx'))
          .map(path => ({ path, name: path.slice(path.lastIndexOf('/') + 1) }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setCandidates(found)
        if (found.length === 0) {
          setStatus('empty')
          setSelected(undefined)
          setParsed(undefined)
          return
        }
        // Keep the current pick across a refresh when it still exists.
        const keep = found.some(f => f.path === selectedRef.current)
        setSelected(keep ? selectedRef.current : (found[0] as Candidate).path)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setStatus('error')
        setError(describe(cause))
      })

    return () => controller.abort()
  }, [visible, scope, nonce])

  // ── load + parse the selected file ────────────────────────────────────
  useEffect(() => {
    if (!visible || selected === undefined) return
    const controller = new AbortController()

    setStatus('loading')
    setError(undefined)

    fsReadText(scope, selected, controller.signal)
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
  }, [visible, scope, selected])

  // ── image seam ────────────────────────────────────────────────────────
  const baseDir = selected === undefined ? '' : dirOf(selected)
  const resolveImage = useCallback(
    (ref: string): string | undefined => {
      // A literal URL or data URI needs no host round-trip.
      if (ref.startsWith('data:') || /^https?:\/\//i.test(ref)) return ref
      // Absolute filesystem paths are outside the workspace fence; showing the
      // placeholder is the honest answer rather than a 403 image.
      if (/^[A-Za-z]:[\\/]/.test(ref) || ref.startsWith('\\\\')) return undefined
      return mediaUrl(scope, resolveRef(baseDir, ref))
    },
    [scope, baseDir],
  )

  const errorText = useMemo(
    () => (error === undefined ? '' : error),
    [error],
  )

  // ── render ────────────────────────────────────────────────────────────
  const bar =
    candidates.length > 1
      ? createElement(
          'div',
          { style: BAR_STYLE },
          createElement(
            'select',
            {
              style: SELECT_STYLE,
              value: selected ?? '',
              onChange: (event: { target: { value: string } }) => setSelected(event.target.value),
              'aria-label': t('tab.title'),
            },
            candidates.map(c => createElement('option', { key: c.path, value: c.path }, c.name)),
          ),
          createElement('button', {
            type: 'button',
            style: BUTTON_STYLE,
            onClick: () => setNonce(n => n + 1),
          }, t('action.reload')),
        )
      : null

  let body: ReactNode
  if (status === 'idle' || status === 'loading') {
    body = createElement(Notice, { title: t('state.loading') })
  } else if (status === 'empty') {
    body = createElement(Notice, {
      title: t('state.empty'),
      detail: t('state.emptyHint'),
      action: createElement('button', { type: 'button', style: BUTTON_STYLE, onClick: () => setNonce(n => n + 1) }, t('action.reload')),
    })
  } else if (status === 'error') {
    body = createElement(Notice, {
      title: t('state.error'),
      detail: errorText,
      action: createElement('button', { type: 'button', style: BUTTON_STYLE, onClick: () => setNonce(n => n + 1) }, t('action.retry')),
    })
  } else if (parsed !== undefined && !parsed.ok) {
    // A parse failure is a per-file result, not a wire failure: say which one.
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
