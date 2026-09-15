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
  readonly sessionId: string
  /** The session's working directory; the host falls back to its own header. */
  readonly cwd?: string
  /** Selected Git repository when cwd is a workspace container. */
  readonly repoRoot?: string
}

/** One host wire failure. */
export class SidebarApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SidebarApiError'
  }
}

/** One envelope as the host writes it. */
interface Envelope<T> {
  ok?: boolean
  value?: T
  error?: { code?: string; message?: string }
}

/** True when the failure means better-sidebar is not serving us at all. */
export function isUnavailable(error: unknown): boolean {
  if (!(error instanceof SidebarApiError)) return false
  // A missing route answers 404 with no envelope, so the code stays `http`.
  return error.code === 'network' || error.code === 'http' || error.code === 'not-found'
}

/** True when the host's workspace fence refused the path. */
export function isOutsideWorkspace(error: unknown): boolean {
  return error instanceof SidebarApiError && error.message.includes('outside workspace')
}

/** POST one method and unwrap the envelope. */
async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/sidebar/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new SidebarApiError('network', error instanceof Error ? error.message : String(error))
  }

  const parsed = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SidebarApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value
}

/** Build the scoped payload both calls share. */
function scoped(scope: Scope, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: scope.sessionId,
    ...(scope.cwd !== undefined && scope.cwd !== '' ? { cwd: scope.cwd } : {}),
    ...(scope.repoRoot !== undefined && scope.repoRoot !== '' ? { repoRoot: scope.repoRoot } : {}),
    ...extra,
  }
}

/** Recursive file-name search from the session cwd; matches are cwd-relative. */
export async function fsSearch(scope: Scope, query: string, signal?: AbortSignal): Promise<string[]> {
  const value = await call<{ matches?: string[] }>('fs.search', scoped(scope, { query }), signal)
  return value.matches ?? []
}

/** Read one text file through the host's workspace-fenced reader. */
export async function fsReadText(
  scope: Scope,
  path: string,
  signal?: AbortSignal,
): Promise<{ content: string; truncated: boolean }> {
  // `fsRead` answers FsTextResult | FsBinaryResult; the `kind` tag is the
  // discriminant and the caller only ever opens `.canvas.tsx`.
  const value = await call<{
    kind?: string
    content?: string
    truncated?: boolean
    size?: number
  }>('fs.read', scoped(scope, { path }), signal)

  if (value.kind !== 'text' || typeof value.content !== 'string') {
    throw new SidebarApiError('binary', `${path} is not a text file`)
  }
  return { content: value.content, truncated: value.truncated === true }
}

/**
 * Absolute URL of the media route for one path — how the document's
 * `<img src>` values are served without base64-encoding them into the tree.
 * Mirrors the sidebar's own `mediaUrl`; the route only serves images.
 */
export function mediaUrl(scope: Scope, path: string): string {
  const params = new URLSearchParams({ sessionId: scope.sessionId, path })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  return `/sidebar/file?${params.toString()}`
}
