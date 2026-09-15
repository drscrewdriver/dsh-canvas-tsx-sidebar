/**
 * Intermediate representation for a statically parsed `.canvas.tsx`.
 *
 * The IR is deliberately small and JSON-serialisable: it is what the renderer
 * consumes and what the golden-snapshot tests compare against. Every value in
 * it came from a LITERAL in the source — nothing is evaluated.
 *
 * Fidelity rule (spec §2.5): a node the parser cannot reduce to literals
 * becomes `{ kind: 'unsupported' }`. The renderer draws a visible notice for
 * it. We never guess, and we never execute source to find out.
 */

/**
 * A statically resolved value lifted out of the source.
 *
 * `null` covers both `null` and `undefined` in the source: JSX props commonly
 * spell "no value here" either way (e.g. `rowTone={["accent", undefined, …]}`),
 * and the renderer treats both as "unset".
 */
export type CanvasProp =
  | string
  | number
  | boolean
  | null
  | CanvasProp[]
  | { [key: string]: CanvasProp }

/** One node of the canvas tree. */
export type CanvasNode =
  /**
   * A component (or native tag) with literal props and children.
   *
   * `tag` is the `qoder/canvas` EXPORT name (import aliases are normalised
   * away), a lowercase HTML tag name, or `''` for a fragment.
   *
   * `unresolved` lists prop names the parser refused to evaluate. Those props
   * are absent from `props` and the renderer marks them — we drop the value
   * rather than guess it, but we keep the rest of the element.
   */
  | {
      kind: 'element'
      tag: string
      props: Record<string, CanvasProp>
      children: CanvasNode[]
      unresolved?: string[]
    }
  /** A run of JSX text, already collapsed per JSX whitespace semantics. */
  | { kind: 'text'; value: string }
  /** A subtree that is not statically reducible — rendered as a notice. */
  | { kind: 'unsupported'; reason: string; snippet?: string }

/** Why extraction failed outright (as opposed to a local `unsupported` node). */
export type ExtractErrorCode =
  /** Source exceeded the size ceiling. */
  | 'too-large'
  /** No `export default` function was found. */
  | 'no-default-export'
  /** The default export does not return JSX. */
  | 'no-jsx-root'
  /** The JSX tree never closes (unbalanced tags / unterminated literal). */
  | 'unterminated'

/** A hard extraction failure. Recoverable per-node gaps use `unsupported` instead. */
export interface ExtractError {
  readonly code: ExtractErrorCode
  readonly message: string
}

/** Outcome of parsing one `.canvas.tsx`. */
export type ExtractResult =
  | { readonly ok: true; readonly root: CanvasNode }
  | { readonly ok: false; readonly error: ExtractError }

/** Build a `text` node. */
export function text(value: string): CanvasNode {
  return { kind: 'text', value }
}

/** Build an `element` node. */
export function element(
  tag: string,
  props: Record<string, CanvasProp>,
  children: CanvasNode[],
): CanvasNode {
  return { kind: 'element', tag, props, children }
}

/** Build an `unsupported` node. */
export function unsupported(reason: string, snippet?: string): CanvasNode {
  return snippet === undefined ? { kind: 'unsupported', reason } : { kind: 'unsupported', reason, snippet }
}

/** Census of a tree, for diagnostics and corpus reporting. */
export interface NodeCounts {
  /** `element` nodes, including fragments. */
  readonly components: number
  /** `text` nodes. */
  readonly texts: number
  /** `unsupported` nodes — the fidelity gap. */
  readonly unsupported: number
}

/** Count the nodes in a tree. */
export function countNodes(node: CanvasNode): NodeCounts {
  let components = 0
  let texts = 0
  let unsupported = 0
  walk(node, n => {
    if (n.kind === 'element') components++
    else if (n.kind === 'text') texts++
    else unsupported++
  })
  return { components, texts, unsupported }
}

/** Depth-first walk in document order. */
export function walk(node: CanvasNode, visit: (node: CanvasNode) => void): void {
  visit(node)
  if (node.kind === 'element') {
    for (const child of node.children) walk(child, visit)
  }
}
