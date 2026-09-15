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
  readonly value: string
  /** Index just past the closing quote (or the point of failure). */
  readonly end: number
  /** The raw source slice, for diagnostics. */
  readonly raw: string
  /** True for a backtick literal containing `${…}` — not a plain constant. */
  readonly hasSubstitution: boolean
  /** False when the literal ran off the end / across a newline. */
  readonly terminated: boolean
}

const SPACE = new Set([' ', '\t', '\n', '\r', '\f', '\v'])

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
}

/** True for a JavaScript identifier start character. */
export function isIdentStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'
}

/** True for a JavaScript identifier continuation character. */
export function isIdentPart(c: string): boolean {
  return isIdentStart(c) || (c >= '0' && c <= '9')
}

/**
 * Skip whitespace and comments starting at `i`.
 * @returns the index of the next significant character (may be `src.length`).
 */
export function skipTrivia(src: string, i: number): number {
  let at = i
  for (;;) {
    while (at < src.length && SPACE.has(src[at] as string)) at++
    if (src[at] === '/' && src[at + 1] === '/') {
      at += 2
      while (at < src.length && src[at] !== '\n') at++
      continue
    }
    if (src[at] === '/' && src[at + 1] === '*') {
      const close = src.indexOf('*/', at + 2)
      at = close === -1 ? src.length : close + 2
      continue
    }
    return at
  }
}

/** Read a JavaScript identifier at `i`, or null when there is none. */
export function readIdent(src: string, i: number): { value: string; end: number } | null {
  if (i >= src.length || !isIdentStart(src[i] as string)) return null
  let at = i + 1
  while (at < src.length && isIdentPart(src[at] as string)) at++
  return { value: src.slice(i, at), end: at }
}

/**
 * Read a JSX tag name at `i`. Wider than a JS identifier: JSX permits `-`
 * (web components), `:` (namespaces) and `.` (member expressions).
 */
export function readJsxTagName(src: string, i: number): { value: string; end: number } | null {
  if (i >= src.length) return null
  const first = src[i] as string
  if (!isIdentStart(first) && first !== '-') return null
  let at = i
  while (at < src.length) {
    const c = src[at] as string
    if (isIdentPart(c) || c === '-' || c === ':' || c === '.') at++
    else break
  }
  return { value: src.slice(i, at), end: at }
}

/**
 * Read a quoted literal starting at `i`.
 * @returns null when `src[i]` does not open a quote.
 */
export function readQuoted(src: string, i: number): Quoted | null {
  const quote = src[i]
  if (quote !== '"' && quote !== "'" && quote !== '`') return null
  const start = i
  let at = i + 1
  let value = ''
  let hasSubstitution = false

  while (at < src.length) {
    const c = src[at] as string
    if (c === '\\') {
      const next = src[at + 1]
      if (next === undefined) break
      const mapped = ESCAPES[next]
      value += mapped === undefined ? next : mapped
      at += 2
      continue
    }
    if (c === quote) {
      return { value, end: at + 1, raw: src.slice(start, at + 1), hasSubstitution, terminated: true }
    }
    if (quote === '`' && c === '$' && src[at + 1] === '{') {
      // A substitution makes this not a constant; skip it so the scan stays balanced.
      hasSubstitution = true
      const close = matchDelimiter(src, at + 1, '{', '}')
      if (close === null) break
      at = close
      continue
    }
    // An unescaped newline ends a ' or " literal (illegal in JS).
    if (quote !== '`' && (c === '\n' || c === '\r')) break
    value += c
    at++
  }

  return { value, end: at, raw: src.slice(start, at), hasSubstitution, terminated: false }
}

/**
 * Given `src[at] === open`, return the index just past its matching `close`,
 * honouring nested delimiters, string literals and comments.
 * @returns null when the delimiter never closes.
 */
export function matchDelimiter(src: string, at: number, open: string, close: string): number | null {
  if (src[at] !== open) return null
  let depth = 0
  let i = at
  while (i < src.length) {
    const c = src[i] as string
    if (c === '"' || c === "'" || c === '`') {
      const q = readQuoted(src, i)
      if (q === null || !q.terminated) return null
      i = q.end
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const next = skipTrivia(src, i)
      if (next <= i) return null
      i = next
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return null
}

/**
 * Indices of every `sep` character at nesting depth zero in `src[from,to)`.
 * Strings, comments and bracketed groups are skipped wholesale.
 */
export function topLevelSeparators(src: string, from: number, to: number, sep: string): number[] {
  const cuts: number[] = []
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
    if (c === '(' || c === '[' || c === '{') {
      const close = c === '(' ? ')' : c === '[' ? ']' : '}'
      const after = matchDelimiter(src, i, c, close)
      i = after === null ? i + 1 : after
      continue
    }
    if (c === sep) {
      cuts.push(i)
      i++
      continue
    }
    i++
  }
  return cuts
}

/**
 * Collapse JSX text children exactly the way React does
 * (`cleanJSXElementLiteralChild`), so multi-line Chinese paragraphs render
 * without stray indentation or hard-wrapped newlines.
 * @param raw - the literal text between two JSX constructs.
 */
export function collapseJsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i] as string)) lastNonEmpty = i
  }
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    const isFirst = i === 0
    const isLast = i === lines.length - 1
    const isLastNonEmpty = i === lastNonEmpty
    let line = (lines[i] as string).replace(/\t/g, ' ')
    if (!isFirst) line = line.replace(/^ +/, '')
    if (!isLast) line = line.replace(/ +$/, '')
    if (line !== '') {
      if (!isLastNonEmpty) line += ' '
      out += line
    }
  }
  return out
}
