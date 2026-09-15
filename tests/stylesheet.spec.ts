/**
 * Stylesheet installation.
 *
 * The document CSS is what makes a `.canvas.tsx` look like a report, and both
 * surfaces (the file viewer and the sidebar tab) share one `<style>` element.
 * Two properties matter and neither is obvious from reading the component:
 *
 * 1. **One element, ever.** The two surfaces are independent React trees that
 *    can mount in either order, so a second mount must not stack a duplicate.
 * 2. **Content-addressed, not first-wins.** Under client-plugin HMR the module
 *    is re-evaluated with new CSS while the DOM keeps the previous element. A
 *    `if (existing) return` guard would pin the page to the stale stylesheet —
 *    a CSS edit would look like it did nothing until a full reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANVAS_CSS } from '../src/client/canvas/styles'
import { STYLE_ID, ensureCanvasStyles } from '../src/client/canvas/stylesheet'

/** The installed stylesheet, or undefined when nothing is installed. */
function installed(): HTMLStyleElement | null {
  return document.getElementById(STYLE_ID) as HTMLStyleElement | null
}

beforeEach(() => {
  document.head.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ensureCanvasStyles', () => {
  it('installs exactly one scoped stylesheet', () => {
    ensureCanvasStyles()
    // The id contains `:` and `/`, so query by tag and filter rather than
    // building a selector (`CSS.escape` is not guaranteed in every engine).
    const matches = [...document.querySelectorAll('style')].filter(s => s.id === STYLE_ID)
    expect(matches).toHaveLength(1)
    expect(installed()?.textContent).toBe(CANVAS_CSS)
  })

  it('is idempotent — a second surface does not stack a duplicate', () => {
    ensureCanvasStyles()
    ensureCanvasStyles()
    ensureCanvasStyles()
    expect(document.querySelectorAll('style')).toHaveLength(1)
  })

  it('refreshes stale bytes instead of keeping the previous revision', () => {
    // Simulate an element left behind by an earlier HMR revision.
    const stale = document.createElement('style')
    stale.id = STYLE_ID
    stale.textContent = '.dsh-canvas-doc .grid-4 { grid-template-columns: repeat(3, 1fr); }'
    document.head.appendChild(stale)

    ensureCanvasStyles()

    expect(document.querySelectorAll('style')).toHaveLength(1)
    expect(installed()?.textContent).toBe(CANVAS_CSS)
    // The container query is the part a stale copy would be missing.
    expect(installed()?.textContent).toContain('@container (max-width: 560px)')
  })

  it('leaves a current stylesheet untouched', () => {
    ensureCanvasStyles()
    const before = installed()
    ensureCanvasStyles()
    // Same node, not a replacement — re-writing would discard the browser's
    // parsed stylesheet for no reason on every mount.
    expect(installed()).toBe(before)
  })

  it('tolerates environments with no document', () => {
    vi.stubGlobal('document', undefined)
    expect(() => {
      ensureCanvasStyles()
    }).not.toThrow()
  })
})
