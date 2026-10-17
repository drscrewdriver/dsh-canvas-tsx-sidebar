import type { Context } from '@deepseek-ai/cordis';
/** Stage-one shape, structural copy of `SidebarRightTabDefinition` (page type). */
interface NativeTabDefinition {
    readonly id: string;
    readonly kind: string;
    readonly title: (address: string) => string;
    readonly guide?: readonly {
        id: string;
        order: number;
        title: () => string;
        description?: () => string;
    }[];
}
interface NativeTabRegistryLike {
    register(definition: NativeTabDefinition): () => void;
}
export type { NativeTabRegistryLike };
/**
 * Whether this host exposes the native right-sidebar tab system at all.
 * @param ctx - the client root context.
 */
export declare function nativeSidebarAvailable(ctx: Context): boolean;
/**
 * Register the report tab as a native right-sidebar tab type.
 *
 * The registry arrives as a parameter, read from the deferred `ctx.inject`
 * scope in `apply` — the 0.1.7+ strict-proxy ctx refuses a root `ctx.get`
 * of an undeclared service, so reaching for `sidebarRightTabs` from the root
 * context is what made the native seat silently no-op on 0.1.7 (the "cannot
 * register directly" observation). better-sidebar's own native bridge reads
 * it the same way: from the inject callback's scope.
 *
 * @param ctx - the client root context (for the declared `slots` service).
 * @param registry - the host tab-type registry from the injected scope.
 * @param deps - the stable ids and the translator from `apply`.
 * @returns a disposer unwinding seat first, then the type.
 */
export declare function registerNativeReportTab(ctx: Context, registry: NativeTabRegistryLike | undefined, deps: {
    id: string;
    kind: string;
    order: number;
    t: (key: string) => string;
}): () => void;
