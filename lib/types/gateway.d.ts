import type { Context } from '@deepseek-ai/cordis';
/**
 * Register both routes on the web shell.
 *
 * @param ctx - the node plugin context.
 * @returns a disposer, or `undefined` when this process serves no web shell
 *   (a pure-agent host) — the caller then installs nothing.
 */
export declare function registerCanvasGateway(ctx: Context): (() => void) | undefined;
