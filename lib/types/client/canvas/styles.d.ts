/**
 * Stylesheet for a rendered canvas document.
 *
 * Two deliberate departures from the plugin's own rules, both because this
 * subtree is a *document*, not plugin chrome:
 *
 * 1. **Literal colours, not `--dsw-alias-*` tokens.** A `.canvas.tsx` encodes a
 *    fixed paper layout; re-tinting it per skin would change what the report
 *    looks like, which is exactly what the author did not ask for. The tokens
 *    stay mandatory for the tab shell around it.
 * 2. **Every selector is scoped under `.dsh-canvas-doc`.** The document tree
 *    lands inside the DSH sidebar, so bare `.card` / `.table` / `.grid` rules
 *    would leak into the host UI. `*` and `img` are the two that must be
 *    rewritten rather than prefixed.
 *
 * Kept as a string (not a CSS module) so the same source drives both the
 * sidebar subtree and the standalone `.rendered.html` export.
 */
/** Root class of a rendered document. */
export declare const CANVAS_ROOT_CLASS = "dsh-canvas-doc";
/** Scoped stylesheet; inject once per document. */
export declare const CANVAS_CSS: string;
/**
 * Standalone page wrapper for the exported `.rendered.html`.
 * Kept separate from {@link CANVAS_CSS} so the embedded (sidebar) build never
 * carries page-level rules.
 */
export declare const CANVAS_PAGE_CSS: string;
