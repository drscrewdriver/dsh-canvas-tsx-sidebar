/**
 * Node half of the Canvas report plugin.
 *
 * On hosts that run better-sidebar the browser half reads files through its
 * `/sidebar/api/fs.read`; on a bare 0.1.5+ host there is no such route, so
 * this half serves the plugin's own gateway (`/canvas/api` + `/canvas/file`,
 * faithful to the dsh-browser-cdp / dsh-mcp-registry webServer pattern) with
 * the same envelope shape the client already speaks. The webServer service is
 * optional: a pure-agent host installs nothing and the browser half simply
 * never runs.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Profile row identity. */
export declare const name = "dsh-canvas-tsx-sidebar";
/**
 * Node-face apply: mount the gateway when this process serves a web shell.
 * @param ctx - the node plugin context.
 */
export declare function apply(ctx: Context): void;
