/**
 * IR -> React tree.
 *
 * This is the single rendering implementation. It backs both the sidebar tab
 * (live React subtree) and the standalone `.rendered.html` export (via
 * `react-dom/server`), so the two can never drift.
 *
 * Ported from the earlier `scripts/render-with-images.ts` prototype. Two things
 * changed in the move:
 *
 * - **Images are URL-resolved, not base64-embedded.** `props.src` now carries
 *   the literal path from the source (the `canvasImage()` identity rule plus the
 *   statement-scanning fix make it resolve), so the caller decides how to fetch
 *   it — `mediaUrl(scope, path)` in the sidebar, a data URI in the export.
 *   The order-matching regex hack the prototype needed is gone.
 * - **Strings became elements.** No `innerHTML`, so there is no escaping step
 *   and no injection surface.
 *
 * Unsupported subtrees render as a visible notice (fidelity rule, spec §2.5):
 * we degrade one node and never guess.
 */
import { createElement, Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { CanvasNode, CanvasProp } from './ir'
import { CANVAS_ROOT_CLASS } from './styles'

/** How the renderer reaches the outside world. */
export interface CanvasRenderOptions {
  /**
   * Map a `canvasImage()` reference (`./shot.png`, an `http(s)` URL, a `data:`
   * URL) to something usable as an `<img src>`.
   *
   * Returning `undefined` renders the placeholder — the reference is shown so
   * the gap is diagnosable rather than silent.
   */
  readonly resolveImage?: (ref: string) => string | undefined
}

// ---------------------------------------------------------------------------
// prop readers
// ---------------------------------------------------------------------------

/** Read a prop as a string; `null`/absent becomes `''`. */
function str(value: CanvasProp | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** Read a prop as a number, falling back when it is absent or non-numeric. */
function num(value: CanvasProp | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Read a prop as an array of records, tolerating anything else. */
function records(value: CanvasProp | undefined): Array<Record<string, CanvasProp>> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, CanvasProp> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  )
}

/** Read a prop as a flat array. */
function list(value: CanvasProp | undefined): CanvasProp[] {
  return Array.isArray(value) ? value : []
}

/**
 * Project a canvas `style={{…}}` literal onto React's style shape.
 *
 * Only scalar entries survive; anything nested is dropped rather than guessed.
 */
function inlineStyle(value: CanvasProp | undefined): CSSProperties | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string | number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number') out[key] = entry
  }
  return Object.keys(out).length === 0 ? undefined : (out as CSSProperties)
}

/** Join class names, dropping empties. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' ')
}

// ---------------------------------------------------------------------------
// shared vocabulary
// ---------------------------------------------------------------------------

/** `tone` -> callout/banner glyph. */
const TONE_ICON: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  caution: '⚠️',
  danger: '🔴',
  critical: '🔴',
  success: '✅',
  positive: '✅',
  neutral: '•',
}

/** `tone` -> `Stat` value colour. */
const STAT_COLOR: Record<string, string> = {
  success: '#16a34a',
  ok: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
  primary: '#2563eb',
  neutral: '#111827',
}

/** `state` -> timeline dot colour. */
const TIMELINE_DOT: Record<string, string> = {
  completed: '#3b82f6',
  done: '#3b82f6',
  current: '#f59e0b',
  active: '#f59e0b',
  pending: '#d1d5db',
  upcoming: '#d1d5db',
}

/** `gap` prop -> CSS length. */
function gapOf(value: CanvasProp | undefined): string {
  if (value === 'section') return '24px'
  if (value === 'component') return '12px'
  return typeof value === 'number' ? `${value}px` : '8px'
}

// ---------------------------------------------------------------------------
// renderer
// ---------------------------------------------------------------------------

/** Render a list of nodes. */
export function renderNodes(nodes: readonly CanvasNode[], options: CanvasRenderOptions = {}): ReactNode[] {
  return nodes.map((child, index) => createElement(Fragment, { key: index }, renderNode(child, options)))
}

/** Render one node. */
export function renderNode(node: CanvasNode, options: CanvasRenderOptions = {}): ReactNode {
  if (node.kind === 'text') return node.value
  if (node.kind === 'unsupported') {
    return createElement('span', { className: 'unsupported' }, node.snippet ?? '…')
  }

  const tag = node.tag === '' ? 'div' : node.tag
  const props = node.props
  const kids = (): ReactNode => renderNodes(node.children, options)
  const text = (): string => node.children.map(c => (c.kind === 'text' ? c.value : '')).join('')

  switch (tag) {
    // ── layout ────────────────────────────────────────────────────────────
    case 'ReportShell':
      return createElement('div', { className: 'report-shell' }, kids())
    case 'Stack':
      return createElement(
        'div',
        { className: 'stack', style: { display: 'flex', flexDirection: 'column', gap: gapOf(props.gap) } },
        kids(),
      )
    case 'Grid': {
      const cols = num(props.columns, 2)
      const gap = typeof props.gap === 'number' ? `${props.gap}px` : '16px'
      // Fixed track count (not `auto-fit`), so the CSS breakpoints below can
      // drop 4 -> 2 without the browser choosing an intermediate 3.
      return createElement(
        'div',
        {
          className: cx('grid', `grid-${cols}`),
          style: { gridTemplateColumns: `repeat(${cols}, 1fr)`, gap },
        },
        kids(),
      )
    }
    case 'Row': {
      const align = props.align === 'center' ? 'center' : props.align === 'end' ? 'flex-end' : 'flex-start'
      return createElement(
        'div',
        { className: 'row', style: { display: 'flex', gap: '12px', alignItems: align } },
        kids(),
      )
    }
    case 'Column':
      return createElement('div', { className: 'column', style: { flex: 1, minWidth: 0 } }, kids())
    case 'ReportSection':
      return createElement(
        'section',
        { className: 'report-section' },
        createElement(
          'div',
          { className: 'section-header' },
          createElement('h2', { className: 'section-title' }, str(props.title)),
          props.description === undefined || props.description === null
            ? null
            : createElement('p', { className: 'section-desc' }, str(props.description)),
        ),
        createElement('div', { className: 'section-body' }, kids()),
      )

    // ── headings ──────────────────────────────────────────────────────────
    case 'H1':
      return createElement('h1', { className: 'h1' }, kids())
    case 'H2':
      return createElement('h2', { className: 'h2' }, kids())
    case 'H3':
      return createElement('h3', { className: 'h3' }, kids())

    // ── text ──────────────────────────────────────────────────────────────
    case 'Text': {
      const tone = str(props.tone)
      const size = str(props.size)
      return createElement('span', { className: cx('text', tone && `text-${tone}`, size && `text-${size}`) }, kids())
    }
    case 'P':
      return createElement('p', { className: 'p' }, kids())
    case 'Pill':
      return createElement('span', { className: cx('pill', `pill-${str(props.color) || str(props.tone) || 'gray'}`) }, kids())
    case 'Tag':
      return createElement('span', { className: cx('tag', `tag-${str(props.tone) || 'neutral'}`) }, kids())
    case 'Badge':
      return createElement('span', { className: 'badge' }, kids())
    case 'Code':
      return createElement('code', { className: 'code' }, kids())
    case 'Pre':
      return createElement('pre', { className: 'pre' }, createElement('code', null, kids()))
    case 'Link':
      return createElement('a', { className: 'link', href: str(props.href) || '#' }, kids())

    // ── data ──────────────────────────────────────────────────────────────
    case 'Table': {
      const columns = records(props.columns)
      const data = records(props.data)
      const headers = list(props.headers)

      let colDefs: Array<{ label: string; key: string }>
      let rowData: Array<Record<string, CanvasProp>>

      if (columns.length > 0 && data.length > 0) {
        colDefs = columns.map(c => ({ label: str(c.label) || str(c.key) || str(c.title), key: str(c.key) }))
        rowData = data
      } else if (headers.length > 0) {
        // `headers` + `rows` positional form: synthesise stable column keys.
        colDefs = headers.map((h, i) => ({ label: str(h), key: `_${i}` }))
        rowData = list(props.rows).map(row => {
          const record: Record<string, CanvasProp> = {}
          list(row).forEach((cell, i) => {
            record[`_${i}`] = cell
          })
          return record
        })
      } else {
        return kids()
      }

      // `rowTone` may be a per-row array or one tone applied to every row.
      const toneRaw = props.rowTone
      const rowTones: string[] = Array.isArray(toneRaw)
        ? toneRaw.map(t => str(t))
        : typeof toneRaw === 'string'
          ? rowData.map(() => toneRaw)
          : []

      return createElement(
        'div',
        { className: 'table-wrap' },
        createElement(
          'table',
          { className: 'table' },
          createElement(
            'thead',
            null,
            createElement(
              'tr',
              null,
              colDefs.map((col, i) => createElement('th', { key: i, className: 'th' }, col.label)),
            ),
          ),
          createElement(
            'tbody',
            null,
            rowData.map((row, ri) =>
              createElement(
                'tr',
                { key: ri, className: cx('tr', rowTones[ri] && `tr-${rowTones[ri]}`) },
                colDefs.map((col, ci) => createElement('td', { key: ci, className: 'td' }, str(row[col.key]))),
              ),
            ),
          ),
        ),
      )
    }
    case 'Stat': {
      const tone = str(props.tone)
      return createElement(
        'div',
        { className: 'stat' },
        createElement('div', { className: 'stat-label' }, str(props.label)),
        createElement('div', { className: 'stat-value', style: { color: STAT_COLOR[tone] ?? '#111827' } }, str(props.value)),
      )
    }
    case 'MetricsGrid': {
      const metrics = records(props.metrics).length > 0 ? records(props.metrics) : records(props.items)
      const cols = num(props.cols, 3)
      const minWidth = cols <= 3 ? '200px' : '240px'
      return createElement(
        'div',
        { className: 'metrics-grid', style: { gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))` } },
        metrics.map((metric, i) =>
          createElement(
            'div',
            { key: i, className: 'metric-card' },
            createElement('div', { className: 'metric-value' }, str(metric.value)),
            createElement('div', { className: 'metric-label' }, str(metric.label)),
          ),
        ),
      )
    }
    case 'Timeline': {
      const items = records(props.items).length > 0 ? records(props.items) : records(props.events)
      return createElement(
        'div',
        { className: 'timeline' },
        items.map((item, i) => {
          // `timestamp` is the SDK field; `time` is the older spelling.
          const when = str(item.timestamp) || str(item.time)
          const description = str(item.description)
          const state = str(item.state)
          return createElement(
            'div',
            { key: i, className: 'timeline-item' },
            createElement('div', {
              className: 'timeline-dot',
              style: { background: TIMELINE_DOT[state] ?? '#d1d5db' },
            }),
            createElement(
              'div',
              { className: 'timeline-content' },
              when === '' ? null : createElement('div', { className: 'timeline-time' }, when),
              createElement('div', { className: 'timeline-title' }, str(item.title)),
              description === '' ? null : createElement('div', { className: 'timeline-desc' }, description),
            ),
          )
        }),
      )
    }
    case 'KeyValue': {
      const items = records(props.items).length > 0 ? records(props.items) : records(props.data)
      if (items.length > 0) {
        return createElement(
          Fragment,
          null,
          items.map((item, i) =>
            createElement(
              'div',
              { key: i, className: 'kv-row' },
              createElement('span', { className: 'kv-label' }, str(item.label)),
              createElement('span', { className: 'kv-value' }, str(item.value)),
            ),
          ),
        )
      }
      return createElement(
        'div',
        { className: 'kv-row' },
        createElement('span', { className: 'kv-label' }, str(props.label)),
        createElement('span', { className: 'kv-value' }, kids()),
      )
    }
    case 'Card':
      return createElement(
        'div',
        { className: 'card' },
        props.subtitle === undefined || props.subtitle === null
          ? null
          : createElement('p', { className: 'card-subtitle' }, str(props.subtitle)),
        kids(),
      )
    case 'CardHeader':
      return createElement(
        'div',
        { className: 'card-header' },
        props.title === undefined || props.title === null
          ? null
          : createElement('div', { className: 'card-header-title' }, str(props.title)),
        kids(),
      )
    case 'CardBody':
      return createElement('div', { className: 'card-body' }, kids())

    // ── notices ───────────────────────────────────────────────────────────
    case 'Callout':
    case 'Banner': {
      const tone = str(props.tone) || str(props.type) || 'info'
      const icon = TONE_ICON[tone] ?? 'ℹ️'
      return createElement(
        'div',
        { className: cx(tag === 'Banner' ? 'banner' : 'callout', `callout-${tone}`) },
        props.title === undefined || props.title === null
          ? null
          : createElement(
              'div',
              { className: 'callout-title' },
              createElement('span', { className: 'callout-icon' }, icon),
              ' ',
              str(props.title),
            ),
        createElement('div', { className: 'callout-body' }, kids()),
      )
    }

    // ── rules + steps ─────────────────────────────────────────────────────
    case 'Separator':
    case 'Divider':
      return createElement('hr', { className: 'divider' })
    case 'Steps':
      return createElement(
        'div',
        { className: 'steps' },
        records(props.items).map((item, i) =>
          createElement(
            'div',
            { key: i, className: 'step' },
            createElement('div', { className: 'step-num' }, i + 1),
            createElement('div', { className: 'step-text' }, str(item.text)),
          ),
        ),
      )

    // ── evidence ──────────────────────────────────────────────────────────
    case 'EvidenceMethodology': {
      const metadata = records(props.metadata)
      const groups = records(props.groups)
      const accounting = str(props.accounting)
      const overview = str(props.overview)
      const summary = str(props.summary)
      const title = str(props.title)
      return createElement(
        'div',
        { className: 'evidence-methodology' },
        title === '' ? null : createElement('h3', { className: 'evi-title' }, title),
        summary === '' ? null : createElement('div', { className: 'evi-summary' }, summary),
        overview === ''
          ? null
          : createElement(
              'div',
              { className: 'evi-overview' },
              createElement('strong', null, '验证流程：'),
              overview,
            ),
        metadata.length === 0
          ? null
          : createElement(
              'table',
              { className: 'table evi-meta' },
              createElement(
                'thead',
                null,
                createElement(
                  'tr',
                  null,
                  createElement('th', { className: 'th' }, '模块'),
                  createElement('th', { className: 'th' }, '结果'),
                ),
              ),
              createElement(
                'tbody',
                null,
                metadata.map((item, i) =>
                  createElement(
                    'tr',
                    { key: i, className: 'tr tr-success' },
                    createElement('td', { className: 'td' }, str(item.label)),
                    createElement('td', { className: 'td' }, str(item.value)),
                  ),
                ),
              ),
            ),
        groups.map((group, gi) =>
          createElement(
            'div',
            { key: gi, className: 'evi-group' },
            createElement('div', { className: 'evi-group-title' }, str(group.title)),
            records(group.items).map((item, ii) =>
              createElement(
                'div',
                { key: ii, className: 'evi-item' },
                createElement('span', { className: 'evi-item-label' }, str(item.label)),
                createElement('span', { className: 'evi-item-value' }, str(item.value)),
              ),
            ),
          ),
        ),
        accounting === ''
          ? null
          : createElement(
              'div',
              { className: 'evi-accounting' },
              createElement('strong', null, '审计说明：'),
              accounting,
            ),
      )
    }

    // ── screenshots ───────────────────────────────────────────────────────
    case 'img': {
      const alt = str(props.alt) || str(props.title) || '截图'
      const ref = str(props.src)
      // With no seam the reference IS the src (a `data:` or `http(s)` literal
      // works untouched). WITH a seam, `undefined` means "I could not resolve
      // this" and must reach the placeholder — it is not a fallback signal.
      const resolved =
        ref === '' ? undefined : options.resolveImage === undefined ? ref : options.resolveImage(ref)
      const style = inlineStyle(props.style)

      if (resolved === undefined) {
        return createElement(
          'figure',
          { className: 'canvas-image-placeholder' },
          createElement('div', { className: 'img-placeholder-box' }, `📷 ${alt}`),
          createElement(
            'figcaption',
            { className: 'img-caption' },
            ref === '' ? '(图片未嵌入)' : `${ref} (未找到)`,
          ),
        )
      }

      return createElement(
        'figure',
        { className: 'canvas-image' },
        createElement('img', { src: resolved, alt, style, loading: 'lazy' }),
        createElement('figcaption', { className: 'img-caption' }, alt),
      )
    }

    // ── html passthrough ──────────────────────────────────────────────────
    case 'br':
      return createElement('br')
    case 'span':
      return createElement('span', { style: inlineStyle(props.style) }, kids())
    case 'div':
      return createElement('div', { style: inlineStyle(props.style) }, kids())
    case 'strong':
      return createElement('strong', null, kids())
    case 'em':
      return createElement('em', null, kids())
    case 'code':
      return createElement('code', { className: 'code' }, kids())

    // ── unknown -> transparent container with a fidelity notice ────────────
    default:
      return createElement(
        'div',
        { className: 'unknown-component', 'data-tag': node.tag || '(Fragment)' },
        kids(),
      )
  }
}

/** Props of {@link CanvasDocument}. */
export interface CanvasDocumentProps {
  /** The parsed root node. */
  readonly root: CanvasNode
  /** Image resolution + other render seams. */
  readonly options?: CanvasRenderOptions
}

/**
 * A whole canvas document: scoping root -> centred page -> paper shell.
 *
 * The shell is added here only when the source does not already provide one.
 * Files rooted at `<Stack>` (a real pattern in the corpus) would otherwise
 * render with no card at all.
 */
export function CanvasDocument(props: CanvasDocumentProps): ReactNode {
  const { root, options } = props
  const hasShell = root.kind === 'element' && root.tag === 'ReportShell'
  return createElement(
    'div',
    { className: CANVAS_ROOT_CLASS, 'data-dsh-canvas': 'document' },
    createElement(
      'div',
      { className: 'page-wrap' },
      hasShell ? renderNode(root, options) : createElement('div', { className: 'report-shell' }, renderNode(root, options)),
    ),
  )
}
