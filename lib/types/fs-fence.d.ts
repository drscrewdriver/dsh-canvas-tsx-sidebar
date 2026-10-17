/** Case-insensitive `target under base` — Windows drives make this necessary. */
export declare function isWithin(base: string, target: string): boolean;
/**
 * Join one client-supplied path onto the session workspace without letting it
 * escape: relative paths resolve under `cwd`, absolute paths must already sit
 * inside `cwd`. `..` segments are collapsed by `path.resolve` before the
 * containment check, so `/ws/../etc` and `../../x` both refuse here; symlink
 * refusals happen later against the real path (gateway stage two).
 *
 * @param cwd - the session workspace root (authoritative, server-side).
 * @param target - the client-supplied path, relative or absolute.
 * @returns the canonical absolute path inside the workspace.
 * @throws when the resolved path leaves the workspace.
 */
export declare function resolveInsideWorkspace(cwd: string, target: string): string;
/** Refusal carrier so the gateway can map it to one envelope code. */
export declare class WorkspaceEscapeError extends Error {
    readonly target: string;
    readonly code = "forbidden";
    constructor(target: string);
}
/** NUL in the first chunk ⇒ treat as binary, matching the host's sniff. */
export declare function looksBinary(chunk: Buffer): boolean;
/** True when a client-supplied cwd string is usable as an absolute root. */
export declare function requireAbsolute(value: string): string | undefined;
