import type { Context } from '@deepseek-ai/cordis';
export interface WebServerLike {
    register(opts: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void | Promise<void>;
    }): () => void;
}
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
export declare function registerCanvasGateway(ctx: Context, resolvedWebServer?: WebServerLike): (() => void) | undefined;
