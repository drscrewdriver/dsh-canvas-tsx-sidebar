import { open, realpath, stat } from "node:fs/promises";
import { isAbsolute, posix, win32 } from "node:path";
//#region src/fs-fence.ts
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
/** POSIX everywhere below: separators normalized, case folded on demand. */
const normalize = (value) => value.replace(/[\\/]+/g, "/").replace(/\/$/, "");
/** Case-insensitive `target under base` — Windows drives make this necessary. */
function isWithin(base, target) {
	const b = normalize(base).toLowerCase();
	const t = normalize(target).toLowerCase();
	return t === b || t.startsWith(`${b}/`);
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
function resolveInsideWorkspace(cwd, target) {
	const pathModule = process.platform === "win32" ? win32 : posix;
	const absolute = isAbsolute(target) || pathModule.isAbsolute(target) ? target : pathModule.resolve(cwd, target);
	const canonical = pathModule.resolve(absolute);
	if (!isWithin(cwd, canonical)) throw new WorkspaceEscapeError(canonical);
	return canonical;
}
/** Refusal carrier so the gateway can map it to one envelope code. */
var WorkspaceEscapeError = class extends Error {
	target;
	code = "forbidden";
	constructor(target) {
		super(`path "${target}" is outside workspace`);
		this.target = target;
		this.name = "WorkspaceEscapeError";
	}
};
/** NUL in the first chunk ⇒ treat as binary, matching the host's sniff. */
function looksBinary(chunk) {
	return chunk.subarray(0, 8192).includes(0);
}
/** True when a client-supplied cwd string is usable as an absolute root. */
function requireAbsolute(value) {
	const pathModule = process.platform === "win32" ? win32 : posix;
	return isAbsolute(value) || pathModule.isAbsolute(value) ? pathModule.resolve(value) : void 0;
}
//#endregion
//#region src/gateway.ts
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
const API_PREFIX = "/canvas/api";
const MEDIA_PREFIX = "/canvas/file";
/** One text response cap; longer files answer `truncated` after this many bytes. */
const TEXT_CAP = 2097152;
/** JSON body cap — canvas paths and session ids are small. */
const BODY_CAP = 65536;
var GatewayError = class extends Error {
	status;
	code;
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
};
const envelopeOk = (value) => JSON.stringify({
	ok: true,
	value
});
const envelopeError = (code, message) => JSON.stringify({
	ok: false,
	error: {
		code,
		message
	}
});
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(body);
}
async function readJsonBody(req) {
	const chunks = [];
	let bytes = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.length;
		if (bytes > BODY_CAP) throw new GatewayError(400, "body-too-large", "request body too large");
		chunks.push(buffer);
	}
	if (chunks.length === 0) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new GatewayError(400, "bad-json", "request body is not JSON");
	}
}
/** Same-origin gate: a present Origin must equal Host (mcp-registry semantics). */
function sameOriginOrThrow(req) {
	const origin = req.headers.origin;
	if (origin === void 0 || origin === "") return;
	let originHost;
	try {
		originHost = new URL(String(origin)).host;
	} catch {
		throw new GatewayError(400, "invalid-origin", "invalid Origin header");
	}
	const host = String(req.headers.host ?? "");
	if (host !== "" && originHost !== host) throw new GatewayError(403, "cross-origin", "cross-origin request refused");
}
/** The authoritative session cwd, then the client's; a refusal if neither. */
async function sessionCwdOf(ctx, payload) {
	const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
	if (sessionId === "") throw new GatewayError(400, "bad-request", "sessionId is required");
	let headerCwd;
	try {
		headerCwd = (ctx.get?.("sessions") ?? ctx.sessions)?.get?.(sessionId)?.header?.cwd;
	} catch {
		headerCwd = void 0;
	}
	if (headerCwd !== void 0 && headerCwd !== "") return headerCwd;
	const clientCwd = typeof payload.cwd === "string" ? requireAbsolute(payload.cwd) : void 0;
	if (clientCwd !== void 0) return clientCwd;
	throw new GatewayError(404, "unknown-session", `no workspace resolvable for session "${sessionId}"`);
}
/** One fenced read: string containment, then realpath containment, then sniff. */
async function readFenced(cwd, target) {
	const canonical = resolveInsideWorkspace(cwd, target);
	let real;
	try {
		real = await realpath(canonical);
		if (!isWithin(await realpath(cwd), real)) throw new WorkspaceEscapeError(real);
	} catch (error) {
		if (error instanceof WorkspaceEscapeError) throw error;
		return { kind: "missing" };
	}
	const info = await stat(real).catch(() => void 0);
	if (info === void 0 || !info.isFile()) return { kind: "missing" };
	const handle = await open(real, "r");
	try {
		const buffer = Buffer.alloc(Math.min(Number(info.size), 2097153));
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
		const head = buffer.subarray(0, bytesRead);
		if (looksBinary(head)) return { kind: "binary" };
		const truncated = Number(info.size) > TEXT_CAP;
		return {
			kind: "text",
			content: head.subarray(0, Math.min(bytesRead, TEXT_CAP)).toString("utf8"),
			truncated
		};
	} finally {
		await handle.close();
	}
}
const MEDIA_TYPES = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/vnd.microsoft.icon"
};
/**
* Register both routes on the web shell.
*
* @param ctx - the node plugin context.
* @param resolvedWebServer - a webServer already resolved by the caller (the
*   apply-side `ctx.inject(['webServer'])` arm); when omitted it is looked up
*   here, which only succeeds if the provider fiber is already ACTIVE.
* @returns a disposer, or `undefined` when this process serves no web shell
*   (a pure-agent host) — the caller then installs nothing.
*/
function registerCanvasGateway(ctx, resolvedWebServer) {
	const webServer = resolvedWebServer ?? ctx.get?.("webServer");
	if (webServer === void 0 || typeof webServer.register !== "function") return void 0;
	const apiDispose = webServer.register({
		kind: "prefix",
		path: API_PREFIX,
		handler: async (reqRaw, resRaw) => {
			const res = resRaw;
			const req = reqRaw;
			try {
				if (req.method !== "POST") {
					writeJson(res, 405, envelopeError("method-not-allowed", "POST only"));
					return;
				}
				sameOriginOrThrow(req);
				const method = (req.url ?? "").slice(11).replace(/^\//, "").split("?")[0];
				const body = await readJsonBody(reqRaw);
				const cwd = await sessionCwdOf(ctx, body);
				if (method === "session.info") {
					writeJson(res, 200, envelopeOk({ cwd }));
					return;
				}
				if (method === "fs.read") {
					const path = typeof body.path === "string" ? body.path : "";
					if (path === "") throw new GatewayError(400, "bad-request", "path is required");
					const result = await readFenced(cwd, path);
					writeJson(res, 200, envelopeOk(result));
					return;
				}
				writeJson(res, 404, envelopeError("not-found", `unknown method "${method}"`));
			} catch (error) {
				if (error instanceof GatewayError) {
					writeJson(res, error.status, envelopeError(error.code, error.message));
					return;
				}
				if (error instanceof WorkspaceEscapeError) {
					writeJson(res, 403, envelopeError(error.code, error.message));
					return;
				}
				writeJson(res, 500, envelopeError("internal", error instanceof Error ? error.message : String(error)));
			}
		}
	});
	const mediaDispose = webServer.register({
		kind: "prefix",
		path: MEDIA_PREFIX,
		handler: async (reqRaw, resRaw) => {
			const res = resRaw;
			const req = reqRaw;
			try {
				if (req.method !== "GET" && req.method !== "HEAD") {
					writeJson(res, 405, envelopeError("method-not-allowed", "GET only"));
					return;
				}
				sameOriginOrThrow(req);
				const url = new URL(req.url ?? "", "http://127.0.0.1");
				const cwd = await sessionCwdOf(ctx, {
					sessionId: url.searchParams.get("sessionId") ?? "",
					cwd: url.searchParams.get("cwd") ?? void 0
				});
				const path = url.searchParams.get("path") ?? "";
				if (path === "") throw new GatewayError(400, "bad-request", "path is required");
				const canonical = resolveInsideWorkspace(cwd, path);
				const real = await realpath(canonical).catch(() => void 0);
				if (real === void 0 || !isWithin(await realpath(cwd), real)) throw new GatewayError(404, "not-found", "not found");
				const info = await stat(real).catch(() => void 0);
				if (info === void 0 || !info.isFile()) throw new GatewayError(404, "not-found", "not found");
				const dot = real.lastIndexOf(".");
				const type = MEDIA_TYPES[dot === -1 ? "" : real.slice(dot).toLowerCase()] ?? "application/octet-stream";
				const handle = await open(real, "r");
				try {
					const buffer = Buffer.alloc(Math.min(Number(info.size), 16777216));
					const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
					res.writeHead(200, {
						"content-type": type,
						"cache-control": "no-store"
					});
					res.end(buffer.subarray(0, bytesRead));
				} finally {
					await handle.close();
				}
			} catch (error) {
				if (error instanceof GatewayError) {
					writeJson(res, error.status, envelopeError(error.code, error.message));
					return;
				}
				writeJson(res, 500, envelopeError("internal", error instanceof Error ? error.message : String(error)));
			}
		}
	});
	return () => {
		apiDispose();
		mediaDispose();
	};
}
//#endregion
//#region src/index.ts
/** Profile row identity. */
const name = "dsh-canvas-tsx-sidebar";
/**
* Node-face apply: mount the gateway when this process serves a web shell.
*
* `ctx.get('webServer')` returns `undefined` while the provider fiber is not
* yet ACTIVE (cordis strict reflect), and mounting directly would then
* silently install nothing — so when the immediate lookup misses, the mount
* is deferred through `ctx.inject(['webServer'])`, which fires once the
* service becomes available. webServer stays an *optional* dependency: on a
* pure-agent host the inject callback simply never runs.
* @param ctx - the node plugin context.
*/
function apply(ctx) {
	const mount = (scope, webServer) => {
		const dispose = registerCanvasGateway(scope, webServer);
		if (typeof dispose === "function") scope.effect?.(() => dispose, "dsh-canvas-tsx-sidebar: gateway");
	};
	const mounted = ctx.get?.("webServer");
	if (mounted !== void 0) {
		mount(ctx, mounted);
		return;
	}
	ctx.inject(["webServer"], (scope) => {
		mount(scope, scope.webServer);
	});
}
//#endregion
export { apply, name };

//# sourceMappingURL=index.mjs.map