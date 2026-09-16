/**
 * Character-level scanner primitives for the canvas parser.
 *
 * Why hand-rolled instead of a regex or a bundled compiler (spec §2.5): a
 * regex cannot survive JSX nesting or a `>`/`<` inside a string, and the
 * TypeScript compiler is ~8 MB — far too large for a browser bundle. These
 * primitives are string-, comment-, and brace-aware, which is what makes the
 * recursive-descent parser above them reliable.
 *
 * Everything here is pure and allocation-light; none of it executes source.
 */
/** One scanned quoted literal. */
export interface Quoted {
    /** Decoded content (escape sequences resolved). */
    readonly value: string;
    /** Index just past the closing quote (or the point of failure). */
    readonly end: number;
    /** The raw source slice, for diagnostics. */
    readonly raw: string;
    /** True for a backtick literal containing `${…}` — not a plain constant. */
    readonly hasSubstitution: boolean;
    /** False when the literal ran off the end / across a newline. */
    readonly terminated: boolean;
}
/** True for a JavaScript identifier start character. */
export declare function isIdentStart(c: string): boolean;
/** True for a JavaScript identifier continuation character. */
export declare function isIdentPart(c: string): boolean;
/**
 * Skip whitespace and comments starting at `i`.
 * @returns the index of the next significant character (may be `src.length`).
 */
export declare function skipTrivia(src: string, i: number): number;
/** Read a JavaScript identifier at `i`, or null when there is none. */
export declare function readIdent(src: string, i: number): {
    value: string;
    end: number;
} | null;
/**
 * Read a JSX tag name at `i`. Wider than a JS identifier: JSX permits `-`
 * (web components), `:` (namespaces) and `.` (member expressions).
 */
export declare function readJsxTagName(src: string, i: number): {
    value: string;
    end: number;
} | null;
/**
 * Read a quoted literal starting at `i`.
 * @returns null when `src[i]` does not open a quote.
 */
export declare function readQuoted(src: string, i: number): Quoted | null;
/**
 * Given `src[at] === open`, return the index just past its matching `close`,
 * honouring nested delimiters, string literals and comments.
 * @returns null when the delimiter never closes.
 */
export declare function matchDelimiter(src: string, at: number, open: string, close: string): number | null;
/**
 * Indices of every `sep` character at nesting depth zero in `src[from,to)`.
 * Strings, comments and bracketed groups are skipped wholesale.
 */
export declare function topLevelSeparators(src: string, from: number, to: number, sep: string): number[];
/**
 * Collapse JSX text children exactly the way React does
 * (`cleanJSXElementLiteralChild`), so multi-line Chinese paragraphs render
 * without stray indentation or hard-wrapped newlines.
 * @param raw - the literal text between two JSX constructs.
 */
export declare function collapseJsxText(raw: string): string;
