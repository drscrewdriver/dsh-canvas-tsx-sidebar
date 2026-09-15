/**
 * Static value resolution.
 *
 * Extends the plain literal parser with a CLOSED set of syntactic forms that
 * real canvas files use and that can be resolved without executing anything:
 *
 *   1. `undefined` / `null`            -> `null` (a keyword, not an expression)
 *   2. `EXPR as const` / `EXPR as T`   -> `EXPR`  (a pure TS assertion: erased at runtime)
 *   3. `NAME` where `const NAME = <resolvable>`  (module-scope symbol table)
 *   4. `ARR.map(() => LIT)`            -> LIT repeated arr.length times
 *      `ARR.map(p => [p.a, p.b])`      -> tuple projection over a static array
 *   5. `canvasImage('lit')`            -> `'lit'` (the SDK documents this as
 *      "use one direct string literal: a local ./file, HTTP(S) URL, or Data URL")
 *
 * Rules 3-5 are NOT evaluation: each is a syntactic rewrite with a fixed,
 * checkable shape. There is no `eval`, no `new Function`, and no arbitrary
 * call evaluation. Anything outside this closed set stays `UNSUPPORTED`, and
 * the renderer degrades that one node.
 *
 * Rationale for the extension: a corpus audit of 41 real canvas files found
 * ~35 `rows`, ~26 `src`, ~16 `rowTone` and ~10 `items` props hitting the
 * "non-literal" path — i.e. tables, metric grids and screenshots rendering
 * EMPTY on 21 of 41 files. Every one of those forms is in the closed set above.
 */
import {
  isIdentPart,
  matchDelimiter,
  readIdent,
  readQuoted,
  skipTrivia,
  topLevelSeparators,
} from './lex'
import type { CanvasProp } from './ir'

/** Sentinel for "not resolvable under the closed rule set". */
export const UNSUPPORTED = Symbol('unsupported')

/** Resolution context threaded through the recursion. */
export interface ResolveContext {
  /** Module-level `const NAME = <expr text>` initialisers. */
  readonly consts: ReadonlyMap<string, string>
  /** Names bound by `import` — never resolvable locally. */
  readonly imports: ReadonlySet<string>
  /** Guards self-referential consts. */
  readonly depth: number
}

/** Recursion ceiling for const chains. */
const MAX_DEPTH = 12

/** The one SDK helper we unwrap, since it is documented as an identity. */
const CANVAS_IMAGE = 'canvasImage'

// ---------------------------------------------------------------------------
// scanning helpers
// ---------------------------------------------------------------------------

/** Split `[from,to)` at the given cut indices into `[start,end)` ranges. */
function segments(from: number, to: number, cuts: readonly number[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let start = from
  for (const cut of cuts) {
    out.push([start, cut])
    start = cut + 1
  }
  out.push([start, to])
  return out
}

/**
 * Find a top-level `=` that introduces an initialiser (not `==`, `=>`, `<=`, …).
 * @returns the index, or null.
 */
function findInitialiserEquals(src: string, from: number): number | null {
  let i = from
  while (i < src.length) {
    const c = src[i] as string
    if (c === '"' || c === "'" || c === '`') {
      const q = readQuoted(src, i)
      i = q === null ? i + 1 : Math.max(q.end, i + 1)
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const next = skipTrivia(src, i)
      i = next > i ? next : i + 1
      continue
    }
    if (c === '(' || c === '[' || c === '{' || c === '<') {
      const close = c === '(' ? ')' : c === '[' ? ']' : c === '{' ? '}' : null
      if (close !== null) {
        const after = matchDelimiter(src, i, c, close)
        if (after !== null) {
          i = after
          continue
        }
      }
      i++
      continue
    }
    if (c === '=') {
      const prev = src[i - 1] as string | undefined
      const next = src[i + 1] as string | undefined
      if (prev !== '=' && prev !== '!' && prev !== '<' && prev !== '>' && next !== '=' && next !== '>') {
        return i
      }
    }
    i++
  }
  return null
}

/** Index just past the `;` ending a module-level statement starting at `from`. */
function findStatementEnd(src: string, from: number): number {
  let i = from
  let lastSignificant = from
  while (i < src.length) {
    const c = src[i] as string
    if (c === '"' || c === "'" || c === '`') {
      const q = readQuoted(src, i)
      i = q === null ? i + 1 : Math.max(q.end, i + 1)
      lastSignificant = i
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const next = skipTrivia(src, i)
      i = next > i ? next : i + 1
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      const close = c === '(' ? ')' : c === '[' ? ']' : '}'
      const after = matchDelimiter(src, i, c, close)
      if (after !== null) {
        i = after
        lastSignificant = i
        continue
      }
      i++
      continue
    }
    if (c === ';') return i
    if (!/\s/.test(c)) lastSignificant = i + 1
    i++
  }
  return lastSignificant
}

/**
 * Strip a trailing `as const` / `as SomeType` assertion.
 * @returns the expression text with the assertion removed, or null if absent.
 */
export function stripAsAssertion(raw: string): string | null {
  const s = raw
  let i = 0
  while (i < s.length) {
    const c = s[i] as string
    if (c === '"' || c === "'" || c === '`') {
      const q = readQuoted(s, i)
      i = q === null ? i + 1 : Math.max(q.end, i + 1)
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      const close = c === '(' ? ')' : c === '[' ? ']' : '}'
      const after = matchDelimiter(s, i, c, close)
      if (after !== null) {
        i = after
        continue
      }
      i++
      continue
    }
    // ` as ` as a standalone word: whitespace on both sides of the two-char
    // token, then something type-shaped. (`as` occupies i and i+1, so the
    // trailing boundary lives at i+2.)
    if (
      /\s/.test(s[i - 1] ?? '') &&
      s.startsWith('as', i) &&
      /\s/.test(s[i + 2] ?? '')
    ) {
      const after = skipTrivia(s, i + 2)
      const head = s[after] as string | undefined
      if (head !== undefined && /[A-Za-z_$({[]/.test(head)) {
        const prefix = s.slice(0, i).trim()
        return prefix === '' ? null : prefix
      }
    }
    i++
  }
  return null
}

/**
 * Collect `const NAME = <initialiser>` bindings in `src[from, to)`.
 *
 * Only declarations at THAT level are taken: any bracketed group is skipped
 * wholesale, so consts nested inside blocks are ignored (hoisting them would
 * require real scoping analysis).
 */
function collectConstsInRange(
  src: string,
  from: number,
  to: number,
  out: Map<string, string>,
): void {
  let i = from
  while (i < to) {
    const c = src[i] as string
    if (c === '"' || c === "'" || c === '`') {
      const q = readQuoted(src, i)
      i = q === null ? i + 1 : Math.max(q.end, i + 1)
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const next = skipTrivia(src, i)
      i = next > i ? next : i + 1
      continue
    }
    // Any bracketed group is skipped wholesale, which is what keeps this at
    // one level: the function body is one big `{…}` group.
    if (c === '{' || c === '(' || c === '[') {
      const close = c === '(' ? ')' : c === '[' ? ']' : '}'
      const after = matchDelimiter(src, i, c, close)
      if (after === null || after > to) break
      i = after
      continue
    }

    const keyword = /^(const|let|var)\b/.exec(src.slice(i, i + 6))
    if (keyword !== null && (i === 0 || !isIdentPart(src[i - 1] as string))) {
      let j = skipTrivia(src, i + keyword[0].length)
      const name = readIdent(src, j)
      if (name !== null) {
        j = name.end
        const eq = findInitialiserEquals(src, j)
        if (eq !== null && eq < to) {
          const initStart = skipTrivia(src, eq + 1)
          const initEnd = findStatementEnd(src, initStart)
          out.set(name.value, src.slice(initStart, initEnd))
          i = initEnd
          continue
        }
      }
    }
    i++
  }
}

/**
 * Collect module-level `const NAME = <initialiser>` bindings.
 */
export function collectModuleConsts(src: string): Map<string, string> {
  const out = new Map<string, string>()
  collectConstsInRange(src, 0, src.length, out)
  return out
}

/**
 * Locate the default export function's body range.
 *
 * Needed because real canvas files declare their data tables INSIDE the
 * component (`const techStack = […]` before the `return`) just as often as at
 * module scope. Those initialisers are equally static.
 */
export function findDefaultExportBody(src: string): [number, number] | null {
  const marker = /\bexport\s+default\b/.exec(src)
  if (marker === null) return null
  let i = skipTrivia(src, marker.index + marker[0].length)

  // `export default function name(...) {` / `export default (...) => {`
  if (src.startsWith('function', i) && !isIdentPart(src[i + 8] ?? '')) {
    i = skipTrivia(src, i + 8)
    if (src[i] === '*') i = skipTrivia(src, i + 1) // generator
    const name = readIdent(src, i)
    if (name !== null) i = skipTrivia(src, name.end)
  }
  if (src[i] !== '(') return null
  const paramsEnd = matchDelimiter(src, i, '(', ')')
  if (paramsEnd === null) return null
  i = skipTrivia(src, paramsEnd)

  // Arrow with an expression body has no braces to scan.
  if (!src.startsWith('function', marker.index + marker[0].length) && src[i] === '=' && src[i + 1] === '>') {
    i = skipTrivia(src, i + 2)
  }
  // Skip a return-type annotation (`: Foo`). The tricky case is `: { … } {`,
  // where the first braces are the TYPE and the second pair is the body — so
  // look ahead for the body brace rather than stopping at the first one.
  if (src[i] === ':') {
    let j = skipTrivia(src, i + 1)
    if (src[j] === '{') {
      const typeEnd = matchDelimiter(src, j, '{', '}')
      if (typeEnd !== null) {
        const afterType = skipTrivia(src, typeEnd)
        if (src[afterType] === '{') j = afterType
      }
    } else {
      while (j < src.length && src[j] !== '{') {
        const c = src[j] as string
        if (c === '(' || c === '[') {
          const close = matchDelimiter(src, j, c, c === '(' ? ')' : ']')
          if (close === null) break
          j = close
          continue
        }
        j++
      }
    }
    i = j
  }

  if (src[i] !== '{') return null
  const bodyEnd = matchDelimiter(src, i, '{', '}')
  if (bodyEnd === null) return null
  return [i + 1, bodyEnd - 1]
}

/**
 * Collect consts declared directly in the default export's body.
 * Merged over module-level consts (a body declaration shadows the outer one).
 */
export function collectFunctionConsts(src: string): Map<string, string> {
  const out = new Map<string, string>()
  const body = findDefaultExportBody(src)
  if (body === null) return out
  collectConstsInRange(src, body[0], body[1], out)
  return out
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

/** `ARR.map(PARAM => BODY)` shape, resolved against a static array. */
function tryMapProjection(raw: string, ctx: ResolveContext): CanvasProp | typeof UNSUPPORTED {
  const s = raw.trim()
  const mapAt = s.indexOf('.map')
  if (mapAt <= 0) return UNSUPPORTED
  const receiver = s.slice(0, mapAt).trim()
  let j = skipTrivia(s, mapAt + 4)
  if (s[j] !== '(') return UNSUPPORTED
  const callClose = matchDelimiter(s, j, '(', ')')
  if (callClose === null || callClose !== s.length) return UNSUPPORTED

  const args = s.slice(j + 1, callClose - 1)
  const arrowAt = args.indexOf('=>')
  if (arrowAt === -1) return UNSUPPORTED
  const paramRaw = args.slice(0, arrowAt).trim().replace(/^\(/, '').replace(/\)$/, '').trim()
  const bodyRaw = args.slice(arrowAt + 2).trim()

  const source = resolveValue(receiver, ctx)
  if (source === UNSUPPORTED || !Array.isArray(source)) return UNSUPPORTED

  // `ARR.map(() => LIT)` — the same value for every element.
  if (paramRaw === '') {
    const value = resolveValue(bodyRaw, ctx)
    if (value === UNSUPPORTED) return UNSUPPORTED
    return source.map(() => value)
  }

  // Projection body: `[p.a, p.b]` or a single `p.a`.
  const body = bodyRaw.trim()
  const isTuple = body.startsWith('[') && (matchDelimiter(body, 0, '[', ']') ?? -1) === body.length
  const itemTexts = isTuple
    ? segments(1, body.length - 1, topLevelSeparators(body, 1, body.length - 1, ',')).map(([a, b]) =>
        body.slice(a, b).trim(),
      )
    : [body]

  const picked: Array<string | null> = itemTexts.map(item => {
    if (item === '') return null
    // `PARAM.field` — walk one level.
    const m = /^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/.exec(item)
    if (m !== null && m[1] === paramRaw) return m[2] as string
    // A non-member literal is allowed verbatim.
    const literal = resolveValue(item, { ...ctx, depth: ctx.depth + 1 })
    return literal === UNSUPPORTED ? undefined as unknown as string : JSON.stringify(literal)
  })

  if (picked.some(p => p === undefined)) return UNSUPPORTED

  const out: CanvasProp[] = []
  for (const element of source) {
    if (element === null || typeof element !== 'object' || Array.isArray(element)) return UNSUPPORTED
    const record = element as Record<string, CanvasProp>
    const row: CanvasProp[] = []
    for (const pick of picked) {
      if (pick === null) continue
      if (pick.startsWith('"')) row.push(JSON.parse(pick) as CanvasProp)
      else if (!(pick in record)) return UNSUPPORTED
      else row.push(record[pick] as CanvasProp)
    }
    out.push(isTuple ? row : (row[0] as CanvasProp))
  }
  return out
}

/**
 * Resolve one expression's source text to a value, or `UNSUPPORTED`.
 * Total: never throws, never evaluates.
 */
export function resolveValue(raw: string, ctx: ResolveContext): CanvasProp | typeof UNSUPPORTED {
  if (ctx.depth > MAX_DEPTH) return UNSUPPORTED
  const s = raw.trim()
  if (s === '') return UNSUPPORTED

  // 2. TS assertion: erased at runtime, so stripping it cannot change meaning.
  const stripped = stripAsAssertion(s)
  if (stripped !== null) return resolveValue(stripped, ctx)

  // 1. Keywords that are not expressions.
  if (s === 'undefined' || s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false

  // String literal.
  const quoted = readQuoted(s, 0)
  if (quoted !== null) {
    if (quoted.terminated && quoted.end === s.length && !quoted.hasSubstitution) return quoted.value
    return UNSUPPORTED
  }

  // Number literal.
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return Number(s)

  // Array literal.
  if (s.startsWith('[')) {
    const close = matchDelimiter(s, 0, '[', ']')
    if (close === null || close !== s.length) return UNSUPPORTED
    const out: CanvasProp[] = []
    for (const [a, b] of segments(1, s.length - 1, topLevelSeparators(s, 1, s.length - 1, ','))) {
      const seg = s.slice(a, b).trim()
      if (seg === '') continue
      const value = resolveValue(seg, { ...ctx, depth: ctx.depth + 1 })
      if (value === UNSUPPORTED) return UNSUPPORTED
      out.push(value)
    }
    return out
  }

  // Object literal.
  if (s.startsWith('{')) {
    const close = matchDelimiter(s, 0, '{', '}')
    if (close === null || close !== s.length) return UNSUPPORTED
    const out: Record<string, CanvasProp> = {}
    for (const [a, b] of segments(1, s.length - 1, topLevelSeparators(s, 1, s.length - 1, ','))) {
      const seg = s.slice(a, b)
      if (seg.trim() === '') continue
      const colons = topLevelSeparators(seg, 0, seg.length, ':')
      if (colons.length !== 1) return UNSUPPORTED
      const keyRaw = seg.slice(0, colons[0] as number).trim()
      const valRaw = seg.slice((colons[0] as number) + 1).trim()
      let key: string
      const kq = readQuoted(keyRaw, 0)
      if (kq !== null && kq.terminated && kq.end === keyRaw.length) key = kq.value
      else if (/^[A-Za-z_$][\w$]*$/.test(keyRaw)) key = keyRaw
      else return UNSUPPORTED
      const value = resolveValue(valRaw, { ...ctx, depth: ctx.depth + 1 })
      if (value === UNSUPPORTED) return UNSUPPORTED
      out[key] = value
    }
    return out
  }

  // 5. `canvasImage('./x.png')` — documented as taking one direct string literal.
  if (s.startsWith(`${CANVAS_IMAGE}(`)) {
    const open = s.indexOf('(')
    const close = matchDelimiter(s, open, '(', ')')
    if (close === null || close !== s.length) return UNSUPPORTED
    return resolveValue(s.slice(open + 1, close - 1), { ...ctx, depth: ctx.depth + 1 })
  }

  // 4. `.map()` projection over a static array.
  if (s.includes('.map')) {
    const projected = tryMapProjection(s, ctx)
    if (projected !== UNSUPPORTED) return projected
    return UNSUPPORTED
  }

  // 3. Module-level const reference.
  const ident = readIdent(s, 0)
  if (ident !== null && ident.end === s.length) {
    if (ctx.imports.has(ident.value)) return UNSUPPORTED
    const init = ctx.consts.get(ident.value)
    if (init === undefined) return UNSUPPORTED
    if (init.trim() === s) return UNSUPPORTED // self-reference guard
    return resolveValue(init, { ...ctx, depth: ctx.depth + 1 })
  }

  return UNSUPPORTED
}

/** Build a resolver bound to one source file. */
export function createResolver(
  src: string,
  importedNames: ReadonlySet<string>,
): (raw: string) => CanvasProp | typeof UNSUPPORTED {
  // Module-scope consts first, then the default export's own body bindings —
  // body declarations shadow the outer ones, matching JS scoping for the one
  // function we extract from. (Consts inside nested blocks are intentionally
  // not collected: hoisting them would need real scope analysis.)
  const consts = collectModuleConsts(src)
  for (const [name, init] of collectFunctionConsts(src)) consts.set(name, init)
  const ctx: ResolveContext = { consts, imports: importedNames, depth: 0 }
  return (raw: string) => resolveValue(raw, ctx)
}
