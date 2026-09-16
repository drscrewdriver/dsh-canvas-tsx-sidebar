# Components that actually render

The supported set is **38 tags**. It is not the Qoder Canvas SDK's export list —
the SDK ships far more, and this viewer renders the 38 below.

> **How this list is kept honest:** `tests/skill.spec.ts` parses the `case`
> labels out of `src/client/canvas/render.tsx` and asserts they match the block
> below exactly, and that the "not supported" names below are absent from the
> renderer. Add a component to the renderer without listing it here and the
> suite fails.

## The exact supported set

<!-- supported:begin — one tag per line, in renderer case order -->
```text
ReportShell
Stack
Grid
Row
Column
ReportSection
H1
H2
H3
Text
P
Pill
Tag
Badge
Code
Pre
Link
Table
Stat
MetricsGrid
Timeline
KeyValue
Card
CardHeader
CardBody
Callout
Banner
Separator
Divider
Steps
EvidenceMethodology
img
br
span
div
strong
em
code
```
<!-- supported:end -->

The last seven are native HTML tags with dedicated handling — `img` gets real
treatment (see *Media*), and the rest are transparent containers that honour a
scalar `style`.

**Any other lowercase tag also passes straight through as native HTML.**
`<header>`, `<main>`, `<ul>`, `<li>`, `<figure>`, `<table>` all render as
themselves and are never reported as gaps. The dashed-box notice is reserved for
a **capitalised** tag — a component this viewer does not map. So the rule is:

| You wrote | Result |
|---|---|
| A tag from the list above | Rendered as intended |
| Any other **lowercase** tag | Passed through as native HTML |
| Any other **capitalised** tag | Dashed box captioned with the tag name |

Anything capitalised and unlisted — including every other SDK export — renders as
that dashed box. It does not throw, and it does not disappear, but it is a
visible gap the reader will see.

## Layout and framing

| Tag | Props that render | Notes |
|---|---|---|
| `ReportShell` | — | The page frame. Supplies width, padding, background, border. `width` / `ariaLabel` / `density` are accepted but this viewer owns the width, so they have no effect here. |
| `ReportSection` | `title`, `description` | Renders a bordered heading plus optional description, then the children. |
| `Stack` | `gap` | Vertical flex. `gap="section"` → 24px, `"component"` → 12px, a number → px, anything else → 8px. |
| `Grid` | `columns` (**number literal**), `gap` (**number literal**) | Fixed track count, so it can collapse predictably. `columns={4}` drops to 2 below a 560px container and to 1 below 300px. A string `columns` such as `"repeat(...)"` is ignored and falls back to 2. |
| `Row` | `align` | Horizontal flex with **no wrapping** — prefer `Grid` when the sidebar may be narrow. |
| `Column` | — | `flex: 1; min-width: 0`. Only meaningful inside a `Row`. |
| `Divider`, `Separator` | — | An `<hr>`. Both spellings are the same element. |

## Headings, text, and inline

| Tag | Props that render | Notes |
|---|---|---|
| `H1`, `H2`, `H3` | — | |
| `Text` | `tone`, `size` | `tone`: `primary` (the default foreground), `secondary`, `tertiary`, `quaternary`. `size`: `body`, `small`, `sm`. |
| `P` | — | Paragraph. |
| `Code` | — | Inline monospace chip. |
| `Pre` | — | Dark code block. |
| `Link` | `href` | |
| `Pill` | `tone` | Rounded. Also accepts the older `color` spelling (`green` / `red` / `yellow` / `blue` / `gray`). |
| `Tag` | `tone` | Square corners. |
| `Badge` | — | Neutral chip, no tone. |

`tone` on `Pill` and `Tag` accepts the full SDK union: `neutral`, `primary`,
`success`, `warning`, `danger`, `info`, `added`, `deleted`.

## Data

### `Table` — two shapes, and the rows prop is named `rows`

```tsx
// Preferred: a column definition plus records. `title` is the heading,
// `key` is the field to read out of each row.
const cols = [{ key: 'vendor', title: '厂商' }, { key: 'sdk', title: 'SDK' }];
const rows = [{ vendor: '火山引擎', sdk: 'volcengine-python-sdk' }];
<Table columns={cols} rows={rows} />
```

```tsx
// Also fine: positional rows, which need no field names.
<Table headers={['厂商', 'SDK']} rows={[['火山引擎', 'volcengine-python-sdk']]} />
```

- The record array may be named `rows` (the SDK name) or `data`. `rows` is the
  one the SDK documents — use it. If a `Table` renders **empty**, this is why.
- A column with a `key` but no `title` prints the raw field name as its heading.
  Always give a column a `title`.
- `rowTone` takes one tone for every row, or an array of tones read per row:
  `rowTone="success"` / `rowTone={['accent', undefined, 'danger']}`. The valid
  values are `default`, `muted`, `accent`, `neutral`, `success`, `warning`,
  `danger`, `info`, `positive`, `caution`, `critical`.
- Column `render`, `align`, and `width` are **not** rendered — the viewer emits a
  plain table. Don't rely on them.
- Two or three columns read well in the sidebar. More than four and the table
  scrolls sideways.

### Everything else

| Tag | Props that render |
|---|---|
| `Stat` | `label`, `value`, `tone` |
| `MetricsGrid` | `items` (or the older `metrics`), `columns` (or the older `cols`) |
| `Timeline` | `events` (or the older `items`) |
| `KeyValue` | `items` (`[{label, value}]`), or the older `data`, or `label` plus children |
| `Steps` | `items` (`[{text}]`) |
| `Card` | `subtitle`, plus children |
| `CardHeader` | `title`, plus children |
| `CardBody` | children only |
| `Callout`, `Banner` | `tone` (or the older `type`), `title`, plus children |
| `EvidenceMethodology` | `title`, `summary`, `overview`, `metadata`, `groups`, `accounting` |
| `img` | `src`, `alt`, `title`, `style` |

`Stat` reads `label` and `value` only. The SDK also offers `unit`,
`valuePrefix`, `valueSuffix`, `trend`, `change`, and `description` — fold those
into `value` or `label` instead, or they are lost.

Each `Timeline` event reads `timestamp` (or the older `time`), `title`,
`description`, and `state`. `state` is `completed`, `current`, or `upcoming`.
Events are drawn in the order given — sort them yourself.

`MetricsGrid` lays out with `auto-fit`, so it reflows on its own at any width —
unlike `Grid`, it needs no help from you.

`Callout` / `Banner` tones are `info`, `warning`, `danger`, `success`,
`neutral`, `positive`, `caution`, `critical`. Each gets a matching glyph.

## Media

```tsx
import { canvasImage } from 'qoder/canvas';

const shot = canvasImage('./screenshot.png');
<img src={shot} alt="Build output" />
```

`canvasImage()` takes **one direct string literal** — a local `./path`, an
`http(s)` URL, or a `data:` URL. The reference is kept in the source and resolved
at render time. A path that cannot be resolved draws a labelled placeholder
rather than a broken image, so keep the reference meaningful.

## Not supported — these render as a dashed placeholder box

Do not use these in a canvas meant for this viewer, even though the SDK exports
them and Qoder's own preview renders them:

- **Charts:** `BarChart`, `LineChart`, `AreaChart`, `PieChart`, `RadarChart`,
  `RadialBarChart`, `ActivityHeatmap`, `ChartContainer`, `ChartComparisonGrid`,
  `MultiplierBubbleChart`, `PriorityQuadrantChart`.
- **Report extras:** `Fluency`, `MaturityMatrix`, `ImprovementKataCard`,
  `ImprovementList`, `ImprovementDisclosure`, `SourceLocationsDisclosure`,
  `CapabilityHexMap`, `ReportSectionHeader`, `RiskHeatmap`, `RiskCallout`,
  `ReferencePanel`, `DocsSection`.
- **Inline data widgets:** `Delta`, `Progress`, `PairedComparisonTable`,
  `TableRow`, `TableCell`.
- **Interactive:** `Button`, `IconButton`, `Input`, `TextArea`, `Checkbox`,
  `Switch`, `Select`, `Dialog`, `CollapsibleSection`, `CollapsibleCard`,
  `ScrollArea`, `Spacer`, `Skeleton`, `ZoomableViewport`, `SendToChatButton`,
  `ScheduleQuestButton`, `Presentation`, `PresentationSlide`,
  `PresentationStack`, `PresentationFragment`.
- **Code review:** `FileReview`, `DiffGroup`, `ReviewComment`, `ReviewThread`,
  `CanvasFormatViewer`.

For a chart, write the numbers as a `Table` or a `Grid` of `Stat`s. That is a
worse chart and a better report in a 400px column anyway.
