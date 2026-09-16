---
name: writing-qoder-canvas
description: Use when writing, generating, or repairing a Qoder Canvas `.canvas.tsx` file — a structured report, status summary, evidence review, metrics page, or any analysis meant to render as a page in the DSH right sidebar. Also use when a `.canvas.tsx` renders blank, shows a dashed box captioned with a component name, drops a table column, or loses an entire `Table`.
---

# Writing Qoder Canvas reports

A `.canvas.tsx` is a TypeScript file whose default export returns JSX built from
`qoder/canvas` primitives. It renders as a fixed paper page — not an app.

**REQUIRED REFERENCE:** `references/components.md` — the components that actually
render, and their props. Read it before choosing a component.

**REQUIRED REFERENCE:** `references/expressions.md` — which values survive the
static parser. Read it before writing any prop that is not a plain string.

**REQUIRED REFERENCE:** `references/layout.md` — read this if the file will be
viewed in the DSH sidebar rather than Qoder's 960px preview.

## The one thing that decides success

**The viewer never executes the file.** It is statically parsed, and every value
is resolved from source *literals* by a closed rule set. Anything else does not
exist at render time.

Two consequences account for nearly every failure:

| What you wrote | What happens |
|---|---|
| A **child** that is not a reducible literal | A yellow notice replaces that subtree |
| A **prop** that is not a reducible literal | That prop is **dropped silently**; the element still renders |
| A **capitalised tag** that is not supported | A dashed box carrying the component's own name |

Lowercase tags are plain HTML and always pass through, so `<header>` and
`<main>` are safe. A dashed box always means a *component* name.

So: **compute nothing inside JSX. Precompute everything into `const` literals.**

## Skeleton

```tsx
import { H1, ReportSection, ReportShell, Stack, Stat, Text } from 'qoder/canvas';

export default function Report() {
  return (
    <ReportShell width="wide" ariaLabel="Report title">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>Report title</H1>
            <Text tone="secondary">Scope · date · branch · commit</Text>
          </Stack>
        </header>

        <ReportSection title="Findings" description="One line of scope">
          <Text>Content.</Text>
        </ReportSection>
      </Stack>
    </ReportShell>
  );
}
```

`ReportShell` is the page frame and owns the width, padding, and background.
Do not rebuild it from a padded `Stack` or a `style={{maxWidth}}`.

## The five rules

1. **Escape `{` and `}` in prose.** JSX reads `{...}` as an expression container,
   so `（0 + {'created': ...}）` written as narrative is a **syntax error** that can
   blank the whole file. Write `{'{'}` / `{'}'}`, or wrap the sentence in
   `{'...'}`. This is the single most common fatal mistake in real canvases.
2. **Hoist data into a `const`.** Module level or the top of the default export
   function. A `const` inside a nested block is not looked up.
3. **`undefined` is legal as a list element** — it means "use the default", e.g.
   `rowTone={['accent', undefined, undefined]}`.
4. **Use only supported components.** `references/components.md` lists all 38
   handled tags. Charts, `Delta`, `Progress`, `CollapsibleSection`, and every
   interactive control are SDK-legal but render as an empty dashed placeholder.
5. **Author for the narrow case.** A report that reads well at 960px in Qoder
   can be cramped in the sidebar. `Grid` reflows; `Table` does not.

## Workflow

1. Choose components **only** from the supported list.
2. Write every table / metric / timeline array as a `const` literal first.
3. Write the JSX, referencing those consts.
4. Self-check before finishing:
   - no bare `{` or `}` inside prose text;
   - no `.map()` callback containing `? :`, a function call, or a member chain;
   - no component outside the supported list;
   - `Grid columns={n}` uses a **number literal**, not a string.
5. Render it and confirm no yellow notice and no dashed box appears.

## Red flags — stop and fix

- A `Table` came out **empty**. Its rows are almost certainly named `rows`
  (SDK) while something else expected `data` — or the array is not a literal.
  See `references/components.md`.
- A column heading shows a raw field name like `scan_methods`. The column
  defines `key` but no `title`.
- A tone value did nothing. Every SDK tone value paints; if nothing changed, the
  prop was dropped as a non-literal.
- The file looks right in Qoder's 960px preview and cramped in the sidebar.
  Read `references/layout.md`.
