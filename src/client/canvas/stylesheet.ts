/**
 * The one place that owns the document stylesheet's identity and installation.
 *
 * Both surfaces — the file viewer and the sidebar tab — render the same
 * document, so they must share a single `<style>` element. They are separate
 * React trees that can mount in either order, so "install once per page" cannot
 * be tracked with a local flag; the DOM is the only shared state.
 *
 * Installation is content-addressed rather than first-wins. Under client-plugin
 * HMR the module is re-evaluated with new CSS while the DOM keeps the element
 * from the previous revision, so a naive `if (existing) return` guard pins the
 * page to the stale stylesheet until a full reload — a CSS edit would appear to
 * do nothing. Comparing the current text and rewriting on a mismatch makes an
 * edit land on the next render.
 */
import { CANVAS_CSS } from './styles'

/** Stylesheet id — shared by every surface so duplicates cannot stack. */
export const STYLE_ID = 'dsh-canvas-tsx-sidebar/styles'

/**
 * Install the document stylesheet, or refresh it in place when its bytes are
 * stale.
 *
 * The element is deliberately never removed: doing so would flash every other
 * mounted canvas surface, and the content check already makes a re-run a no-op.
 */
export function ensureCanvasStyles(): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(STYLE_ID)
  if (existing === null) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CANVAS_CSS
    document.head.appendChild(style)
    return
  }

  if (existing.textContent !== CANVAS_CSS) existing.textContent = CANVAS_CSS
}
