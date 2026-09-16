/**
 * The tone vocabularies a rendered canvas promises to PAINT.
 *
 * These lists mirror the string unions in the Qoder Canvas SDK
 * (`~/.qoder/canvas/sdk/*.d.ts`). They live here, in the repo, because the
 * stylesheet is only correct if every value the SDK can legally put in a tone
 * prop has a rule waiting for it — and a rule nobody checks is a rule that
 * eventually goes missing.
 *
 * `tests/tones.spec.ts` iterates these lists and asserts `CANVAS_CSS` carries a
 * matching class for each entry. So the groups below are a *contract*, not a
 * comment: drop a value and the gate fails; add a rule and nothing needs to
 * change here.
 *
 * Source of each union (SDK revision vendored at `~/.qoder/canvas/sdk`):
 * - `Tone` / `TagTone` / `PillTone` — core-primitives.d.ts:6-8
 * - `CalloutTone`                    — core-primitives.d.ts:19
 * - `TableRowTone`                   — core-primitives.d.ts:14
 * - `TextProps['tone']`              — core-primitives.d.ts:69
 */

/** `Tone` — shared by `Tag` and `Pill`. core-primitives.d.ts:6. */
export const TONE = [
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
  'info',
  'added',
  'deleted',
] as const

/** `CalloutTone` — `Callout` and `Banner`. core-primitives.d.ts:19. */
export const CALLOUT_TONE = [
  'info',
  'warning',
  'danger',
  'success',
  'neutral',
  'positive',
  'caution',
  'critical',
] as const

/** `TableRowTone` — `rowTone` on either `Table` shape. core-primitives.d.ts:14. */
export const TABLE_ROW_TONE = [
  'default',
  'muted',
  'accent',
  'neutral',
  'success',
  'warning',
  'danger',
  'info',
  'positive',
  'caution',
  'critical',
] as const

/** `TextProps['tone']` — core-primitives.d.ts:69. */
export const TEXT_TONE = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

/**
 * Values that are correct to WRITE but deliberately paint nothing, because they
 * are the unstyled baseline. The gate skips exactly these and nothing else.
 */
export const UNPAINTED: Readonly<Record<string, readonly string[]>> = {
  // `primary` is the document's own foreground colour.
  text: ['primary'],
  // `default` is the baseline row: no background, no accent.
  row: ['default'],
}
