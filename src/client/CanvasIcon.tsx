/**
 * Tab glyph.
 *
 * Skin contract (guide §12): plugin-drawn glyphs must take their colour from
 * the `--dsw-alias-*` tokens — no colour literals anywhere in this file. The
 * `tests/theme.spec.ts` guard scans this module for exactly that.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'

/**
 * A page-with-chart mark for the Canvas report tab.
 * @param size - square edge in px (host passes its own tab-icon size).
 */
export function CanvasIcon(size: number): ReactNode {
  return createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block', flex: 'none' },
    },
    createElement('path', {
      d: 'M3.5 2h6.2L13 5.3V12a2 2 0 0 1-2 2H3.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z',
      stroke: 'var(--dsw-alias-label-tertiary)',
      strokeWidth: 1.2,
      strokeLinejoin: 'round',
    }),
    createElement('path', {
      d: 'M9.4 2.2v3.2h3.3',
      stroke: 'var(--dsw-alias-label-tertiary)',
      strokeWidth: 1.2,
      strokeLinejoin: 'round',
    }),
    createElement('path', {
      d: 'M4.6 10.6v-2.1M7.2 10.6V7.2M9.8 10.6V8.9',
      stroke: 'var(--dsw-alias-state-business-primary)',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
  )
}
