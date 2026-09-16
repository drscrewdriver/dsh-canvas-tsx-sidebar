# Writing for the sidebar, not for a 960px preview

A canvas renders in two very different places:

| Surface | Width |
|---|---|
| Qoder's own preview of a `width="wide"` report | ~960px |
| Qoder's reading preview | ~640px |
| **The DSH right sidebar** | **~400px** |

A file that reads well at 960px can be cramped at 400px. If the report will be
viewed in the sidebar, **author for the narrow case first** and treat the wide
preview as a bonus.

## What reflows by itself, and what does not

| Component | Behaviour at ~400px |
|---|---|
| `Grid columns={4}` | **Collapses to 2×2.** Then to 1 column below ~300px. |
| `Grid columns={3}` | Collapses to 2 columns. |
| `Grid columns={2}` | Stays 2, until it goes to 1 near 300px. |
| `MetricsGrid` | Reflows on its own at any width (`auto-fit`). Safe anywhere. |
| `Table` | **Does not reflow.** It scrolls sideways inside its own box. |
| `Row` | **Does not wrap.** Its children squeeze instead. |
| `Stat` | Centred card; a long label wraps to two lines rather than breaking out. |
| `img` | Scales down; capped at 500px tall. |

The collapse thresholds are container queries, not media queries. They measure
**the column the document was given**, so they fire when the sidebar narrows even
though the browser window is wide.

### Why the numbers are what they are

The layout spends width before a grid track sees any of it: `.page-wrap` has 20px
of padding on each side, and `.report-shell` another 20px/24px. A 4-track grid
therefore needs roughly 560px of container to keep four `Stat` labels on one
line — below that it goes straight to 2, never through 3.

Practical consequence: in a 400px sidebar a `columns={4}` grid is **always 2×2**.
That is the right shape for four headline numbers, so `columns={4}` is a good
choice — just know what it will look like.

## Rules that keep a report readable in the sidebar

1. **Keep tables to three columns.** Beyond four, the reader is scrolling
   sideways for every row. If you need more, split the table by theme.
2. **Prefer `Grid` over `Row`.** `Row` never wraps, so two items side by side at
   400px each get 190px.
3. **Do not set fixed pixel widths.** `style` is ignored on most components (see
   below), and a hard `minWidth` on `Grid` is ignored entirely.
4. **Use `MetricsGrid` for headline numbers**, not a hand-rolled `Grid` of
   `Stat`. It reflows without any threshold to get right.
5. **Let `ReportShell` own the page frame.** Do not add padding, margins, or a
   container of your own — you would be guessing at a width you cannot see.
6. **Sort timelines and keep titles short.** Long titles wrap to three lines and
   the dot column starts to dominate.

## `style` is only honoured in three places

Inline `style={{...}}` is applied on `div`, `span`, and `img` — and nowhere else.
Every other component ignores it, including `Stack`, `Grid`, `Card`, `Text`, and
`Table`. If you reach for `style` to fix a layout, reach for a different
component or a different nesting instead.

Related: only **scalar** entries survive in `style`. A nested value is dropped
rather than guessed.

## A checklist before you finish

- [ ] Every `Grid columns={n}` uses a number, and the count is 2, 3, or 4.
- [ ] No `Table` has more than four columns.
- [ ] No `Row` is carrying content that matters at 400px.
- [ ] No `style` on anything except `div` / `span` / `img`.
- [ ] Every `Stat` label is short enough to survive a 118px-wide track.
- [ ] Headline metrics use `MetricsGrid`, not a `Grid` of `Stat`.
