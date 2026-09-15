/**
 * Lexer guards (checklist B14).
 *
 * The point of these tests is the property that makes a hand-rolled parser
 * viable at all: `>` / `<` inside strings, braces inside comments, and
 * nesting must never be misread. A regex cannot do this; that is exactly why
 * the plan rejected regex scanning.
 */
import { describe, expect, it } from 'vitest'
import {
  collapseJsxText,
  matchDelimiter,
  readIdent,
  readJsxTagName,
  readQuoted,
  skipTrivia,
  topLevelSeparators,
} from '../src/client/canvas/lex'

describe('skipTrivia', () => {
  it('skips whitespace, line comments and block comments', () => {
    const src = '  // line\n /* block */ x'
    expect(src[skipTrivia(src, 0)]).toBe('x')
  })

  it('skips a block comment that contains braces and quotes', () => {
    const src = '/* } " < > { */ y'
    expect(src[skipTrivia(src, 0)]).toBe('y')
  })

  it('returns src.length when only trivia remains', () => {
    expect(skipTrivia('   \n // c', 0)).toBe(9)
  })
})

describe('readIdent / readJsxTagName', () => {
  it('reads a JS identifier', () => {
    expect(readIdent('foo_bar1 rest', 0)).toEqual({ value: 'foo_bar1', end: 8 })
  })

  it('refuses a leading digit', () => {
    expect(readIdent('1abc', 0)).toBeNull()
  })

  it('reads a dashed JSX tag name (web component)', () => {
    expect(readJsxTagName('my-element>', 0)).toEqual({ value: 'my-element', end: 10 })
  })
})

describe('readQuoted', () => {
  it('decodes escapes in a double-quoted string', () => {
    const q = readQuoted('"a\\nb"', 0)
    expect(q?.value).toBe('a\nb')
    expect(q?.terminated).toBe(true)
  })

  it('keeps a `>` inside a string — the property regex cannot provide', () => {
    const q = readQuoted('"a > b < c"', 0)
    expect(q?.value).toBe('a > b < c')
    expect(q?.end).toBe(11)
  })

  it('marks a template literal with substitution', () => {
    const src = '`x ${a > b} y`'
    const q = readQuoted(src, 0)
    expect(q?.hasSubstitution).toBe(true)
    expect(q?.terminated).toBe(true)
    expect(q?.end).toBe(src.length)
  })

  it('reports an unterminated single-quoted string', () => {
    expect(readQuoted("'abc", 0)?.terminated).toBe(false)
  })

  it('returns null when there is no opening quote', () => {
    expect(readQuoted('abc', 0)).toBeNull()
  })
})

describe('matchDelimiter', () => {
  it('matches nested braces', () => {
    const src = '{a{b}c}'
    expect(matchDelimiter(src, 0, '{', '}')).toBe(src.length)
  })

  it('ignores braces inside strings — a `}` in a string must not close', () => {
    const src = '{ "}" }'
    expect(matchDelimiter(src, 0, '{', '}')).toBe(src.length)
  })

  it('ignores braces inside comments', () => {
    const src = '{ /* } */ }'
    expect(matchDelimiter(src, 0, '{', '}')).toBe(src.length)
  })

  it('returns null when the delimiter never closes', () => {
    expect(matchDelimiter('{a{b}', 0, '{', '}')).toBeNull()
  })

  it('returns null when a literal inside is unterminated', () => {
    expect(matchDelimiter('{ "abc }', 0, '{', '}')).toBeNull()
  })
})

describe('topLevelSeparators', () => {
  it('ignores separators nested in brackets', () => {
    const src = 'a,[b,c],d'
    expect(topLevelSeparators(src, 0, src.length, ',')).toEqual([1, 7])
  })

  it('ignores separators inside strings', () => {
    const src = "'a,b',c"
    expect(topLevelSeparators(src, 0, src.length, ',')).toEqual([5])
  })
})

describe('collapseJsxText (React semantics)', () => {
  it('drops pure indentation lines and trims the first/last line', () => {
    const raw = '\n        分页：NextToken / Marker 双模式\n      '
    expect(collapseJsxText(raw)).toBe('分页：NextToken / Marker 双模式')
  })

  it('joins a wrapped paragraph with a single space', () => {
    const raw = '\n    第一行，\n    第二行。\n  '
    expect(collapseJsxText(raw)).toBe('第一行， 第二行。')
  })

  it('preserves interior spacing on one line', () => {
    expect(collapseJsxText('a  b')).toBe('a  b')
  })

  it('returns empty for whitespace-only input', () => {
    expect(collapseJsxText('\n   \n  ')).toBe('')
  })
})
