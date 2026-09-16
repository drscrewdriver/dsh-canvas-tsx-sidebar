/**
 * The template-literal guard for `styles.ts`.
 *
 * `CANVAS_CSS` is a JavaScript TEMPLATE LITERAL, so a backtick anywhere inside
 * it — including inside a CSS comment — closes the string early and the next
 * line of prose is parsed as JavaScript. The symptom is an esbuild error
 * pointing at a line of English ("Expected ";" but found "primary""), which
 * says nothing about the real cause.
 *
 * This has now been hit twice. It reads the file as TEXT on purpose: a defect
 * that stops the module from parsing cannot be caught by importing it, so this
 * check has to run before the transform.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/client/canvas/styles.ts')

/**
 * Find the FIRST backtick after the literal opens, and report what follows it.
 *
 * In a healthy file that first backtick is the literal's real terminator, so
 * `.trim()` follows. If a backtick crept into a comment, the first one lands
 * inside the CSS and the text after it is prose — which is exactly the signal.
 */
function afterFirstBacktick(source: string, name: string): string {
  const marker = `export const ${name} = \``
  const start = source.indexOf(marker)
  expect(start, `${name} not declared as a template literal in styles.ts`).toBeGreaterThanOrEqual(0)
  const from = start + marker.length
  const close = source.indexOf('`', from)
  expect(close, `${name} is never closed`).toBeGreaterThan(from)
  return source.slice(close + 1, close + 40)
}

describe('styles.ts — a template literal must not contain a backtick', () => {
  for (const name of ['CANVAS_CSS', 'CANVAS_PAGE_CSS']) {
    it(`${name} closes where it is supposed to`, () => {
      const following = afterFirstBacktick(readFileSync(SOURCE, 'utf8'), name)
      expect(
        following.startsWith('.trim()'),
        `${name} closes onto ${JSON.stringify(following.trim().slice(0, 40))} instead of ".trim()" — ` +
          'a backtick inside a comment closed the template literal early',
      ).toBe(true)
    })
  }

  it('the guard fires on a backtick in a comment', () => {
    // Proof the gate can actually fail — a passing test that cannot fail is
    // not a gate. This is the exact defect that broke the build twice.
    const bad = 'export const CANVAS_CSS = `\n.a { color: red; } /* the `tone` union */\n`.trim()\n'
    expect(afterFirstBacktick(bad, 'CANVAS_CSS').startsWith('.trim()')).toBe(false)
  })
})
