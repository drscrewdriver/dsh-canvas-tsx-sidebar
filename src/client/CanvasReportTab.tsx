/**
 * The sidebar tab component.
 *
 * PHASE 1 PLACEHOLDER — the real implementation lands in Phase 5
 * (task_5.2 `fs.tree` scan + file picker, task_5.3 `fs.read` → extract →
 * render, task_5.4 the four states, task_5.7 the native-tab height contract,
 * task_5.8 the `visible` pause).
 *
 * Two contracts already honoured here so Phase 5 cannot silently regress them:
 *
 * 1. **Height contract** (guide §10): the tab body is mounted inside a
 *    full-height column flex host (`.nativeTabHost`). The host's `.paneBody`
 *    is a definite-height BLOCK scroll container, not a flex container, so a
 *    root that only relies on the outer flex collapses to content height.
 *    The root therefore declares `height: 100%` + `min-height: 0`.
 * 2. **Zero hardcoded colours** (guide §12): every visual value is a
 *    `--dsw-alias-*` token, so all skins follow automatically.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'

export interface CanvasReportTabProps {
  /** The DSH locale service, passed down from `apply` for label lookup. */
  t: (key: string) => string
  /** Whether the tab is currently the visible/active one (guide §9). */
  visible?: boolean
}

/** Root style: see the height contract note above. */
const ROOT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100%',
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
  boxSizing: 'border-box',
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
} as const

/** Placeholder body — replaced wholesale in Phase 5. */
export function CanvasReportTab(props: CanvasReportTabProps): ReactNode {
  const { t } = props
  return createElement(
    'div',
    { style: ROOT_STYLE, 'data-dsh-canvas-tsx': 'root' },
    createElement(
      'div',
      {
        style: {
          margin: 'auto',
          textAlign: 'center',
          color: 'var(--dsw-alias-label-tertiary)',
          fontSize: 13,
          lineHeight: 1.6,
        },
      },
      t('state.pending'),
    ),
  )
}
