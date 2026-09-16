/**
 * Tone coverage gate.
 *
 * A tone prop is the easiest thing in this whole format to get silently wrong:
 * the SDK accepts the value, the file type-checks, and — if the stylesheet has
 * no matching class — the element renders completely unpainted with no warning
 * anywhere. That is a silent fidelity loss, which is exactly the failure mode
 * this plugin exists to refuse.
 *
 * So the rule is inverted into a test: every value in the SDK unions (vendored
 * in `tones.ts`) must have a rule in `CANVAS_CSS`.
 */
import { describe, expect, it } from 'vitest'
import { CANVAS_CSS } from '../src/client/canvas/styles'
import {
  CALLOUT_TONE,
  TABLE_ROW_TONE,
  TEXT_TONE,
  TONE,
  UNPAINTED,
} from '../src/client/canvas/tones'

/** Does the stylesheet define a rule for this exact class? */
function defines(className: string): boolean {
  // Selector position only: `.pill-primary {` or `.pill-primary,` — never a
  // match inside a longer class name like `.pill-primary-hover`.
  return new RegExp(`\\.${className}(?=[\\s,{:])`).test(CANVAS_CSS)
}

/** Assert a whole vocabulary is painted, minus the documented exceptions. */
function expectAllPainted(prefix: string, values: readonly string[], exempt: readonly string[]): void {
  const missing = values.filter(v => !exempt.includes(v) && !defines(`${prefix}-${v}`))
  expect(missing, `no .${prefix}-* rule for: ${missing.join(', ')}`).toEqual([])
}

describe('every SDK tone value has a stylesheet rule', () => {
  it('Callout / Banner — CalloutTone', () => {
    expectAllPainted('callout', CALLOUT_TONE, UNPAINTED.callout ?? [])
  })

  it('Table rowTone — TableRowTone', () => {
    expectAllPainted('tr', TABLE_ROW_TONE, UNPAINTED.row ?? [])
  })

  it('Tag — TagTone (= Tone)', () => {
    expectAllPainted('tag', TONE, UNPAINTED.tag ?? [])
  })

  it('Pill — PillTone (= Tone)', () => {
    expectAllPainted('pill', TONE, UNPAINTED.pill ?? [])
  })

  it('Text — TextProps.tone', () => {
    expectAllPainted('text', TEXT_TONE, UNPAINTED.text ?? [])
  })
})

describe('the gate can actually fail', () => {
  it('defines() rejects a class the stylesheet never defines', () => {
    expect(defines('pill-not-a-tone')).toBe(false)
    expect(defines('tr-not-a-tone')).toBe(false)
  })

  it('defines() is not fooled by a longer class name', () => {
    // `.tr-success` exists; a probe for `.tr-succ` must not match it.
    expect(defines('tr-succ')).toBe(false)
  })
})
