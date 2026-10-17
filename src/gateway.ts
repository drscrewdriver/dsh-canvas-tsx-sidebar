/**
 * /canvas/api + /canvas/file — the plugin's own gateway, the native-path
 * replacement for better-sidebar's `/sidebar/api/fs.read` and `/sidebar/file`.
 *
 * Faithful to the family recipe (dsh-browser-cdp gateway, mirrored by
 * dsh-mcp-registry's surface-http): prefix routes on the OPTIONAL webServer,
 * POST-only JSON API with same-origin enforcement, `{ok, value|error}`
 * envelope, bounded body. The media route is GET because `<img src>` cannot
 * POST; it carries no verbs, so the cookie-authenticated same-origin surface
 * plus the workspace fence is the whole guarantee.
 *
 * The session workspace root is resolved SERVER-SIDE first
 * (`sessions.get(id).header.cwd`, the same authoritative face
 * better-sidebar's `sessionCwdOf` reads); the client-supplied `cwd` is only a
 * fallback for hosts whose session record is not in the header cache. Unlike
 * better-sidebar there is NO user-disableable fence switch here — reads that
 * leave the workspace refuse, unconditionally (see `fs-fence.ts`).
 */
import { open, realpath, stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { isWithin, looksBinary, requireAbsolute, resolveInsideWorkspace, WorkspaceEscapeError } from './fs-fence.ts'

const API_PREFIX = '/canvas/api'
const MEDIA_PREFIX = '/canvas/file'

/** One text response cap; longer files answer `truncated` after this many bytes. */
const TEXT_CAP = 2 * 1024 * 1024
/** JSON body cap — canvas paths and session ids are small. */
const BODY_CAP = 64 * 1024

interface ServerResponseLike {
  writeHead(status: number, headers: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

interface ServerRequestLike {
  method?: string
  headers: Record<string, unknown>
  url?: string
}

class GatewayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const envelopeOk = (value: unknown): string => JSON.stringify({ ok: true, value })
const envelopeError = (code: string, message: string): string =>
  JSON.stringify({ ok: false, error: { code, message } })

function writeJson(res: ServerResponseLike, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body)
}

async function readJsonBody(req: unknown): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req as AsyncIterable<Buffer | Uint8Array>) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    bytes += buffer.length
    if (bytes > BODY_CAP) throw new GatewayError(400, 'body-too-large', 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
  } catch {
    throw new GatewayError(400, 'bad-json', 'request body is not JSON')
  }
}

/** Same-origin gate: a present Origin must equal Host (mcp-registry semantics). */
function sameOriginOrThrow(req: ServerRequestLike): void {
  const origin = req.headers.origin
  if (origin === undefined || origin === '') return
  let originHost: string
  try {
    originHost = new URL(String(origin)).host
  } catch {
    throw new GatewayError(400, 'invalid-origin', 'invalid Origin header')
  }
  const host = String(req.headers.host ?? '')
  if (host !== '' && originHost !== host) {
    throw new GatewayError(403, 'cross-origin', 'cross-origin request refused')
  }
}

/** The authoritative session cwd, then the client's; a refusal if neither. */
async function sessionCwdOf(ctx: Context, payload: Record<string, unknown>): Promise<string> {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''
  if (sessionId === '') throw new GatewayError(400, 'bad-request', 'sessionId is required')
  let headerCwd: string | undefined
  try {
    const sessions =
      (ctx as unknown as { sessions?: { get(id: string): { header?: { cwd?: string } } | undefined } }).sessions ??
      ctx.get?.('sessions' as never)
    headerCwd = (sessions as { get(id: string): { header?: { cwd?: string } } | undefined } | undefined)?.get?.(sessionId)?.header?.cwd
  } catch {
    headerCwd = undefined
  }
  if (headerCwd !== undefined && headerCwd !== '') return headerCwd
  const clientCwd = typeof payload.cwd === 'string' ? requireAbsolute(payload.cwd) : undefined
  if (clientCwd !== undefined) return clientCwd
  throw new GatewayError(404, 'unknown-session', `no workspace resolvable for session "${sessionId}"`)
}

/** One fenced read: string containment, then realpath containment, then sniff. */
async function readFenced(
  cwd: string,
  target: string,
): Promise<{ kind: 'text'; content: string; truncated: boolean } | { kind: 'binary' } | { kind: 'missing' }> {
  const canonical = resolveInsideWorkspace(cwd, target)
  let real: string
  try {
    real = await realpath(canonical)
    const realRoot = await realpath(cwd)
    if (!isWithin(realRoot, real)) throw new WorkspaceEscapeError(real)
  } catch (error) {
    if (error instanceof WorkspaceEscapeError) throw error
    return { kind: 'missing' }
  }
  const info = await stat(real).catch(() => undefined)
  if (info === undefined || !info.isFile()) return { kind: 'missing' }
  const handle = await open(real, 'r')
  try {
    const cap = TEXT_CAP + 1
    const buffer = Buffer.alloc(Math.min(Number(info.size), cap))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const head = buffer.subarray(0, bytesRead)
    if (looksBinary(head)) return { kind: 'binary' }
    const truncated = Number(info.size) > TEXT_CAP
    return { kind: 'text', content: head.subarray(0, Math.min(bytesRead, TEXT_CAP)).toString('utf8'), truncated }
  } finally {
    await handle.close()
  }
}

const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
}

interface WebServerLike {
  register(opts: { kind: string; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }): () => void
}

/**
 * Register both routes on the web shell.
 *
 * @param ctx - the node plugin context.
 * @returns a disposer, or `undefined` when this process serves no web shell
 *   (a pure-agent host) — the caller then installs nothing.
 */
export function registerCanvasGateway(ctx: Context): (() => void) | undefined {
  const webServer = ctx.get?.('webServer') as WebServerLike | undefined
  if (webServer === undefined || typeof webServer.register !== 'function') return undefined

  const apiDispose = webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (reqRaw: unknown, resRaw: unknown): Promise<void> => {
      const res = resRaw as ServerResponseLike
      const req = reqRaw as ServerRequestLike
      try {
        if (req.method !== 'POST') {
          writeJson(res, 405, envelopeError('method-not-allowed', 'POST only'))
          return
        }
        sameOriginOrThrow(req)
        const method = (req.url ?? '').slice(API_PREFIX.length).replace(/^\//, '').split('?')[0]
        const body = await readJsonBody(reqRaw)
        const cwd = await sessionCwdOf(ctx, body)
        if (method === 'session.info') {
          writeJson(res, 200, envelopeOk({ cwd }))
          return
        }
        if (method === 'fs.read') {
          const path = typeof body.path === 'string' ? body.path : ''
          if (path === '') throw new GatewayError(400, 'bad-request', 'path is required')
          const result = await readFenced(cwd, path)
          writeJson(res, 200, envelopeOk(result))
          return
        }
        writeJson(res, 404, envelopeError('not-found', `unknown method "${method}"`))
      } catch (error) {
        if (error instanceof GatewayError) {
          writeJson(res, error.status, envelopeError(error.code, error.message))
          return
        }
        if (error instanceof WorkspaceEscapeError) {
          writeJson(res, 403, envelopeError(error.code, error.message))
          return
        }
        writeJson(res, 500, envelopeError('internal', error instanceof Error ? error.message : String(error)))
      }
    },
  })

  const mediaDispose = webServer.register({
    kind: 'prefix',
    path: MEDIA_PREFIX,
    handler: async (reqRaw: unknown, resRaw: unknown): Promise<void> => {
      const res = resRaw as ServerResponseLike
      const req = reqRaw as ServerRequestLike
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          writeJson(res, 405, envelopeError('method-not-allowed', 'GET only'))
          return
        }
        sameOriginOrThrow(req)
        const url = new URL(req.url ?? '', 'http://127.0.0.1')
        const cwd = await sessionCwdOf(ctx, {
          sessionId: url.searchParams.get('sessionId') ?? '',
          cwd: url.searchParams.get('cwd') ?? undefined,
        })
        const path = url.searchParams.get('path') ?? ''
        if (path === '') throw new GatewayError(400, 'bad-request', 'path is required')
        const canonical = resolveInsideWorkspace(cwd, path)
        const real = await realpath(canonical).catch(() => undefined)
        if (real === undefined || !isWithin(await realpath(cwd), real)) throw new GatewayError(404, 'not-found', 'not found')
        const info = await stat(real).catch(() => undefined)
        if (info === undefined || !info.isFile()) throw new GatewayError(404, 'not-found', 'not found')
        const dot = real.lastIndexOf('.')
        const type = MEDIA_TYPES[(dot === -1 ? '' : real.slice(dot).toLowerCase())] ?? 'application/octet-stream'
        const handle = await open(real, 'r')
        try {
          const buffer = Buffer.alloc(Math.min(Number(info.size), 16 * 1024 * 1024))
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
          res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
          res.end(buffer.subarray(0, bytesRead))
        } finally {
          await handle.close()
        }
      } catch (error) {
        if (error instanceof GatewayError) {
          writeJson(res, error.status, envelopeError(error.code, error.message))
          return
        }
        writeJson(res, 500, envelopeError('internal', error instanceof Error ? error.message : String(error)))
      }
    },
  })

  return (): void => {
    apiDispose()
    mediaDispose()
  }
}
