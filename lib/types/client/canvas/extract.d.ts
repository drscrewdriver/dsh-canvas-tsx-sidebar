import type { ExtractResult } from './ir';
/** Source ceiling. Files above this are rejected outright rather than parsed slowly. */
export declare const MAX_SOURCE_BYTES: number;
/** local name -> `qoder/canvas` export name. */
type ImportMap = Record<string, string>;
/**
 * Collect named imports from `qoder/canvas`.
 * Aliases are folded away so the IR always carries the EXPORT name.
 */
export declare function parseCanvasImports(src: string): ImportMap;
/**
 * Every locally bound import name. These must never be resolved through the
 * module-const table — their values live in another file.
 */
export declare function collectImportedNames(src: string): Set<string>;
/**
 * Locate the JSX root of the default export.
 * @returns the index of the opening `<`, or null.
 */
export declare function findJsxRoot(src: string): number | null;
/**
 * Parse a `.canvas.tsx` source into IR.
 * @param source - the file's text.
 */
export declare function extractCanvas(source: string): ExtractResult;
export {};
