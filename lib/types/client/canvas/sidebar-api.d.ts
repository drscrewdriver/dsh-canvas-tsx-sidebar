/**
 * Minimal client for better-sidebar's HTTP surface.
 *
 * Why this exists instead of `import { api } from 'dsh-better-sidebar/client/api'`:
 * that subpath resolves to the sidebar's ENTIRE client bundle
 * (`"default": "./lib/client.js"`), so a value import would inline a second
 * copy of the sidebar into our bundle. We are a soft dependency — the plugin
 * must stay inert when better-sidebar is absent — so we call its documented
 * routes over the wire and keep zero build-time coupling.
 *
 * The wire contract (mirrored from the sidebar's `src/client/api.ts`):
 *
 *     POST /sidebar/api/<method>
 *     content-type: application/json
 *     body   { sessionId, cwd?, repoRoot?, ...extra }
 *     reply  { ok: true, value } | { ok: false, error: { code, message } }
 *
 * Reusing these routes rather than reading files ourselves is deliberate: the
 * host route owns the workspace-root path fence, so a `../..` reference can
 * never escape the session workspace through us.
 *
 * `Scope` is declared structurally rather than imported from the sidebar's
 * types, so nothing in this module depends on its declaration graph.
 */
/** The session scope every request carries. */
export interface Scope {
    readonly sessionId: string;
    /** The session's working directory; the host falls back to its own header. */
    readonly cwd?: string;
    /** Selected Git repository when cwd is a workspace container. */
    readonly repoRoot?: string;
}
/** One host wire failure. */
export declare class SidebarApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** True when the failure means better-sidebar is not serving us at all. */
export declare function isUnavailable(error: unknown): boolean;
/** True when the host's workspace fence refused the path. */
export declare function isOutsideWorkspace(error: unknown): boolean;
/**
 * Read one text file through the host's reader.
 *
 * `path` may be workspace-relative or absolute; the host resolves both. Note
 * that the host route fences RELATIVE traversal but not absolute paths (a probe
 * of the deployed host read `C:/Windows/win.ini` through it), so callers own
 * that check — see `isInsideWorkspace` in `CanvasReportTab`.
 */
export declare function fsReadText(scope: Scope, path: string, signal?: AbortSignal): Promise<{
    content: string;
    truncated: boolean;
}>;
/**
 * Absolute URL of the media route for one path — how the document's
 * `<img src>` values are served without base64-encoding them into the tree.
 *
 * Returned ORIGIN-ABSOLUTE, matching better-sidebar's own `mediaUrl`: a
 * relative URL would break the moment the markup is rendered anywhere with a
 * different base (an iframe, a blob document), and their shared markdown
 * renderer only accepts absolute http(s) image URLs.
 */
export declare function mediaUrl(scope: Scope, path: string): string;
