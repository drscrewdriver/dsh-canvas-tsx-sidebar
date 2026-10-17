/**
 * Workspace containment for the Canvas gateway.
 *
 * Mirrors better-sidebar's `path-security.ts` decision sequence (resolve →
 * normalize → compare roots), deliberately WITHOUT its user-disableable
 * `workspaceFence` switch: this route exists so the plugin can read canvas
 * files on hosts with no better-sidebar at all, and a canvas viewer has no
 * legitimate reason to serve `C:/Windows/win.ini`. Hard fence, always.
 *
 * Kept as pure sync string logic (no filesystem) so the symlink stage in
 * `gateway.ts` can reuse it after `realpath` has already collapsed links.
 */
import { isAbsolute, win32, posix } from 'node:path'

/** POSIX everywhere below: separators normalized, case folded on demand. */
const normalize = (value: string): string => value.replace(/[\\/]+/g, '/').replace(/\/$/, '')

/** Case-insensitive `target under base` — Windows drives make this necessary. */
export function isWithin(base: string, target: string): boolean {
  const b = normalize(base).toLowerCase()
  const t = normalize(target).toLowerCase()
  return t === b || t.startsWith(`${b}/`)
}

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
export function resolveInsideWorkspace(cwd: string, target: string): string {
  // The running platform decides what "absolute" means, exactly as the
  // server's own filesystem would: a POSIX absolute path on a Windows host
  // resolves against the current drive and the containment check refuses it.
  const pathModule = process.platform === 'win32' ? win32 : posix
  const absolute = isAbsolute(target) || pathModule.isAbsolute(target) ? target : pathModule.resolve(cwd, target)
  const canonical = pathModule.resolve(absolute)
  if (!isWithin(cwd, canonical)) {
    throw new WorkspaceEscapeError(canonical)
  }
  return canonical
}

/** Refusal carrier so the gateway can map it to one envelope code. */
export class WorkspaceEscapeError extends Error {
  readonly code = 'forbidden'
  constructor(readonly target: string) {
    super(`path "${target}" is outside workspace`)
    this.name = 'WorkspaceEscapeError'
  }
}

/** NUL in the first chunk ⇒ treat as binary, matching the host's sniff. */
export function looksBinary(chunk: Buffer): boolean {
  const head = chunk.subarray(0, 8192)
  return head.includes(0)
}

/** True when a client-supplied cwd string is usable as an absolute root. */
export function requireAbsolute(value: string): string | undefined {
  const pathModule = process.platform === 'win32' ? win32 : posix
  return isAbsolute(value) || pathModule.isAbsolute(value) ? pathModule.resolve(value) : undefined
}
