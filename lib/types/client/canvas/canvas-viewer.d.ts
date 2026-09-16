import type { ReactNode } from 'react';
import type { Scope } from './sidebar-api';
/** Minimal subset of `FileViewerProps` the component actually uses. */
export interface ViewerProps {
    readonly scope: Scope;
    readonly path: string;
    readonly title?: string;
}
/** Viewer id — also the settings toggle key (`viewersEnabled[id]`). */
export declare const VIEWER_ID = "dsh-canvas-tsx:viewer";
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
export declare function CanvasFileViewer(props: ViewerProps): ReactNode;
