/** Stylesheet id — shared by every surface so duplicates cannot stack. */
export declare const STYLE_ID = "dsh-canvas-tsx-sidebar/styles";
/**
 * Install the document stylesheet, or refresh it in place when its bytes are
 * stale.
 *
 * The element is deliberately never removed: doing so would flash every other
 * mounted canvas surface, and the content check already makes a re-run a no-op.
 */
export declare function ensureCanvasStyles(): void;
