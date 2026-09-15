/**
 * Static `.canvas.tsx` extractor: source text -> IR.
 *
 * A hand-rolled recursive-descent parser over the primitives in `lex.ts`,
 * with values going through `value.ts`'s closed-rule static resolver.
 *
 * Fidelity contract:
 * - Values resolve only through the CLOSED rule set in `value.ts` (literals,
 *   `undefined`/`null`, `as` assertions, module-level literal consts, `.map()`
 *   projections over static arrays, `canvasImage('lit')`). Nothing is executed.
 * - A non-literal CHILD becomes an `unsupported` node.
 * - A non-literal PROP is dropped and its name recorded in `unresolved`, so the
 *   rest of the element still renders.
 *
 * Known precision ceiling (documented in README): generics, decorators and
 * arbitrary calls are not modelled. They degrade; they never throw.
 */
import {
  collapseJsxText,
  isIdentPart,
  matchDelimiter,
  readIdent,
  readJsxTagName,
  readQuoted,
  skipTrivia,
  topLevelSeparators,
} from './lex'
import { createResolver, UNSUPPORTED } from './value'
import type { CanvasNode, CanvasProp, ExtractResult } from './ir'

/** The one module specifier whose exports we normalise. */
const CANVAS_MODULE = 'qoder/canvas'

/** Source ceiling. Files above this are rejected outright rather than parsed slowly. */
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024

/** local name -> `qoder/canvas` export name. */
type ImportMap = Record<string, string>

/** A value resolver bound to one source file. */
type Resolve = (raw: string) => CanvasProp | typeof UNSUPPORTED

/** Extract `<Name>` into the exported name it maps to. */
function normaliseTag(raw: string, imports: ImportMap): string {
  if (raw === '') return ''
  const first = raw[0] as string
  // Lowercase / dashed names are HTML elements; leave them alone.
  if (first === first.toLowerCase() && first !== first.toUpperCase()) return raw
  return imports[raw] ?? raw
}

/** Split `[from,to)` at the given cut indices into `[start,end)` ranges. */
function splitSegments(from: number, to: number, cuts: readonly number[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let start = from
  for (const cut of cuts) {
    out.push([start, cut])
    start = cut + 1
  }
  out.push([start, to])
  return out
}

/** Parse one import specifier (`Name` or `Name as Alias`). */
function parseSpecifier(segment: string): { local: string; exported: string } | null {
  const parts = segment.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { local: parts[0] as string, exported: parts[0] as string }
  if (parts.length === 3 && parts[1] === 'as') {
    return { local: parts[2] as string, exported: parts[0] as string }
  }
  return null
}

/**
 * Collect named imports from `qoder/canvas`.
 * Aliases are folded away so the IR always carries the EXPORT name.
 */
export function parseCanvasImports(src: string): ImportMap {
  const map: ImportMap = {}
  for (const { local, exported, module } of eachNamedImport(src)) {
    if (module === CANVAS_MODULE) map[local] = exported
  }
  return map
}

/** Every named-import binding in the file, with its source module. */
function* eachNamedImport(src: string): Generator<{ local: string; exported: string; module: string }> {
  let i = 0
  while (i < src.length) {
    const at = src.indexOf('import', i)
    if (at === -1) return
    // Word boundary: do not match `reimport` / an identifier tail.
    if (at > 0 && isIdentPart(src[at - 1] as string)) {
      i = at + 6
      continue
    }
    let j = skipTrivia(src, at + 6)
    if (src.startsWith('type', j) && !isIdentPart(src[j + 4] ?? '')) j = skipTrivia(src, j + 4)
    if (src[j] !== '{') {
      i = at + 6
      continue
    }
    const close = matchDelimiter(src, j, '{', '}')
    if (close === null) return
    let k = skipTrivia(src, close)
    if (!src.startsWith('from', k)) {
      i = at + 6
      continue
    }
    k = skipTrivia(src, k + 4)
    const q = readQuoted(src, k)
    if (q === null || !q.terminated) {
      i = at + 6
      continue
    }
    for (const [a, b] of splitSegments(j + 1, close - 1, topLevelSeparators(src, j + 1, close - 1, ','))) {
      const spec = parseSpecifier(src.slice(a, b))
      if (spec !== null) yield { ...spec, module: q.value }
    }
    i = q.end
  }
}

/**
 * Every locally bound import name. These must never be resolved through the
 * module-const table — their values live in another file.
 */
export function collectImportedNames(src: string): Set<string> {
  const out = new Set<string>()
  for (const { local } of eachNamedImport(src)) out.add(local)
  return out
}

/** Parsed element plus the index just past it. */
interface Parsed {
  node: CanvasNode
  end: number
}

/** Collect children until the matching close tag. */
function parseChildren(
  src: string,
  imports: ImportMap,
  resolve: Resolve,
  at: number,
  parentTag: string | null,
): { children: CanvasNode[]; end: number } | null {
  const children: CanvasNode[] = []
  let i = at
  let textStart = i

  const flushText = (upto: number): void => {
    if (upto <= textStart) return
    const value = collapseJsxText(src.slice(textStart, upto))
    if (value !== '') children.push({ kind: 'text', value })
  }

  while (i < src.length) {
    const c = src[i] as string

    if (c === '<') {
      if (src[i + 1] === '/') {
        flushText(i)
        let j = skipTrivia(src, i + 2)
        let closeName = ''
        if (src[j] === '>') {
          closeName = ''
        } else {
          const cn = readJsxTagName(src, j)
          if (cn === null) return null
          closeName = cn.value
          j = cn.end
        }
        const gt = skipTrivia(src, j)
        if (src[gt] !== '>') return null
        // Verify the close tag matches, so an unbalanced tree fails loudly
        // instead of silently swallowing the rest of the file.
        const expected = parentTag === null ? '' : parentTag
        if (closeName !== expected) return null
        return { children, end: gt + 1 }
      }
      flushText(i)
      const el = parseElement(src, imports, resolve, i)
      if (el === null) return null
      children.push(el.node)
      i = el.end
      textStart = i
      continue
    }

    if (c === '{') {
      const close = matchDelimiter(src, i, '{', '}')
      if (close === null) return null
      flushText(i)
      const expr = src.slice(i + 1, close - 1)
      const trimmed = expr.trim()
      const isComment = trimmed.startsWith('/*') || trimmed.startsWith('//')
      if (trimmed !== '' && !isComment) {
        const value = resolve(expr)
        if (value === UNSUPPORTED) {
          children.push({
            kind: 'unsupported',
            reason: 'non-literal child expression',
            snippet: trimmed.slice(0, 160),
          })
        } else if (typeof value === 'string' || typeof value === 'number') {
          children.push({ kind: 'text', value: String(value) })
        } else {
          children.push({
            kind: 'unsupported',
            reason: 'non-text child value',
            snippet: trimmed.slice(0, 160),
          })
        }
      }
      i = close
      textStart = i
      continue
    }

    i++
  }

  // Ran off the end: the element never closed.
  return null
}

/** Parse one `<...>` element (or fragment) starting at `at`. */
function parseElement(
  src: string,
  imports: ImportMap,
  resolve: Resolve,
  at: number,
): Parsed | null {
  let i = at + 1

  // Fragment: `<> ... </>`
  if (src[i] === '>') {
    const inner = parseChildren(src, imports, resolve, i + 1, null)
    if (inner === null) return null
    return { node: { kind: 'element', tag: '', props: {}, children: inner.children }, end: inner.end }
  }

  const name = readJsxTagName(src, i)
  if (name === null) return null
  i = name.end

  const props: Record<string, CanvasProp> = {}
  const unresolved: string[] = []

  for (;;) {
    i = skipTrivia(src, i)
    const c = src[i]
    if (c === undefined) return null

    if (c === '/' && src[i + 1] === '>') {
      return { node: finish(normaliseTag(name.value, imports), props, unresolved, []), end: i + 2 }
    }

    if (c === '>') {
      const inner = parseChildren(src, imports, resolve, i + 1, name.value)
      if (inner === null) return null
      return {
        node: finish(normaliseTag(name.value, imports), props, unresolved, inner.children),
        end: inner.end,
      }
    }

    // Spread attribute `{...rest}`: not reducible.
    if (c === '{') {
      const close = matchDelimiter(src, i, '{', '}')
      if (close === null) return null
      unresolved.push(src.slice(i + 1, close - 1).trim().slice(0, 60) || '...')
      i = close
      continue
    }

    const attr = readJsxTagName(src, i)
    if (attr === null) return null
    i = skipTrivia(src, attr.end)

    // Valueless attribute is `true`.
    if (src[i] !== '=') {
      props[attr.value] = true
      continue
    }

    i = skipTrivia(src, i + 1)
    const ch = src[i]

    if (ch === '"' || ch === "'") {
      const q = readQuoted(src, i)
      if (q === null || !q.terminated) return null
      props[attr.value] = q.value
      i = q.end
      continue
    }

    if (ch === '{') {
      const close = matchDelimiter(src, i, '{', '}')
      if (close === null) return null
      const value = resolve(src.slice(i + 1, close - 1))
      if (value === UNSUPPORTED) unresolved.push(attr.value)
      else props[attr.value] = value
      i = close
      continue
    }

    return null
  }
}

/** Build an element node, omitting `unresolved` when it is empty. */
function finish(
  tag: string,
  props: Record<string, CanvasProp>,
  unresolved: string[],
  children: CanvasNode[],
): CanvasNode {
  return unresolved.length === 0
    ? { kind: 'element', tag, props, children }
    : { kind: 'element', tag, props, children, unresolved: [...unresolved] }
}

/**
 * Locate the JSX root of the default export.
 * @returns the index of the opening `<`, or null.
 */
export function findJsxRoot(src: string): number | null {
  const marker = /\bexport\s+default\b/.exec(src)
  if (marker === null) return null
  const re = /\breturn\b/g
  re.lastIndex = marker.index + marker[0].length
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const after = skipTrivia(src, m.index + 6)
    if (src[after] === '<') return after
    if (src[after] === '(') {
      const close = matchDelimiter(src, after, '(', ')')
      if (close === null) continue
      const inner = skipTrivia(src, after + 1)
      if (src[inner] === '<') return inner
    }
  }
  return null
}

/**
 * Parse a `.canvas.tsx` source into IR.
 * @param source - the file's text.
 */
export function extractCanvas(source: string): ExtractResult {
  if (source.length > MAX_SOURCE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'too-large',
        message: `source is ${source.length} chars, above the ${MAX_SOURCE_BYTES} ceiling`,
      },
    }
  }

  const root = findJsxRoot(source)
  if (root === null) {
    return {
      ok: false,
      error: {
        code: /export\s+default/.test(source) ? 'no-jsx-root' : 'no-default-export',
        message: 'no JSX root found on the default export',
      },
    }
  }

  const imports = parseCanvasImports(source)
  const resolve = createResolver(source, collectImportedNames(source))
  const parsed = parseElement(source, imports, resolve, root)
  if (parsed === null) {
    return { ok: false, error: { code: 'unterminated', message: 'the JSX tree never closed' } }
  }
  return { ok: true, root: parsed.node }
}
