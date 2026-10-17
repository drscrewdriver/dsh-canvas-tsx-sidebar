import type { Context } from '@deepseek-ai/cordis';
/** Tab type id. Package-prefixed so it cannot collide with a built-in type. */
export declare const TAB_ID = "dsh-canvas-tsx:report";
/** Tab kind on the native host-sidebar path (openTab/guide dispatch key). */
export declare const TAB_KIND = "canvas-report";
/** Services required before `apply` runs. */
export declare const inject: string[];
/**
 * Browser-face apply.
 * @param ctx - the client root context.
 */
export declare function apply(ctx: Context): void;
