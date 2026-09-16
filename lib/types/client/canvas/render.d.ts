import type { ReactNode } from 'react';
import type { CanvasNode } from './ir';
/** How the renderer reaches the outside world. */
export interface CanvasRenderOptions {
    /**
     * Map a `canvasImage()` reference (`./shot.png`, an `http(s)` URL, a `data:`
     * URL) to something usable as an `<img src>`.
     *
     * Returning `undefined` renders the placeholder — the reference is shown so
     * the gap is diagnosable rather than silent.
     */
    readonly resolveImage?: (ref: string) => string | undefined;
}
/** Render a list of nodes. */
export declare function renderNodes(nodes: readonly CanvasNode[], options?: CanvasRenderOptions): ReactNode[];
/** Render one node. */
export declare function renderNode(node: CanvasNode, options?: CanvasRenderOptions): ReactNode;
/** Props of {@link CanvasDocument}. */
export interface CanvasDocumentProps {
    /** The parsed root node. */
    readonly root: CanvasNode;
    /** Image resolution + other render seams. */
    readonly options?: CanvasRenderOptions;
}
/**
 * A whole canvas document: scoping root -> centred page -> paper shell.
 *
 * The shell is added here only when the source does not already provide one.
 * Files rooted at `<Stack>` (a real pattern in the corpus) would otherwise
 * render with no card at all.
 */
export declare function CanvasDocument(props: CanvasDocumentProps): ReactNode;
