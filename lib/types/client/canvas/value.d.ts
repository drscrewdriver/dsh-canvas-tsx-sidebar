import type { CanvasProp } from './ir';
/** Sentinel for "not resolvable under the closed rule set". */
export declare const UNSUPPORTED: unique symbol;
/** Resolution context threaded through the recursion. */
export interface ResolveContext {
    /** Module-level `const NAME = <expr text>` initialisers. */
    readonly consts: ReadonlyMap<string, string>;
    /** Names bound by `import` — never resolvable locally. */
    readonly imports: ReadonlySet<string>;
    /** Guards self-referential consts. */
    readonly depth: number;
}
/**
 * Strip a trailing `as const` / `as SomeType` assertion.
 * @returns the expression text with the assertion removed, or null if absent.
 */
export declare function stripAsAssertion(raw: string): string | null;
/**
 * Collect module-level `const NAME = <initialiser>` bindings.
 */
export declare function collectModuleConsts(src: string): Map<string, string>;
/**
 * Locate the default export function's body range.
 *
 * Needed because real canvas files declare their data tables INSIDE the
 * component (`const techStack = […]` before the `return`) just as often as at
 * module scope. Those initialisers are equally static.
 */
export declare function findDefaultExportBody(src: string): [number, number] | null;
/**
 * Collect consts declared directly in the default export's body.
 * Merged over module-level consts (a body declaration shadows the outer one).
 */
export declare function collectFunctionConsts(src: string): Map<string, string>;
/**
 * Resolve one expression's source text to a value, or `UNSUPPORTED`.
 * Total: never throws, never evaluates.
 */
export declare function resolveValue(raw: string, ctx: ResolveContext): CanvasProp | typeof UNSUPPORTED;
/** Build a resolver bound to one source file. */
export declare function createResolver(src: string, importedNames: ReadonlySet<string>): (raw: string) => CanvasProp | typeof UNSUPPORTED;
