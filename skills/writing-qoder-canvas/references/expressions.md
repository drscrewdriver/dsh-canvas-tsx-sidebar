# What survives the static parser

The viewer resolves every value from source **literals** through a closed set of
rules. Nothing is executed — no `eval`, no `new Function`, no module loading.
Understanding this list is most of writing a canvas that renders.

## The closed rule set

A value resolves if, and only if, it is one of these:

| # | Form | Why it works |
|---|---|---|
| 1 | A literal — `'text'`, `42`, `true`, `null`, `undefined` | It is the value. |
| 2 | `EXPR as const` / `EXPR as SomeType` | `as` is a pure TypeScript assertion, erased at runtime. Strip it and keep resolving. |
| 3 | A `const` name, where `const NAME = <a rule-1-to-5 value>` | Looked up in a static symbol table. |
| 4 | `ARRAY.map(x => LITERAL)` | A projection over a **static** array. |
| 5 | `canvasImage('literal')` | An identity function by contract. |

Everything else does not resolve. For example none of these work:

```tsx
{someCondition ? 'a' : 'b'}          // conditional expression
{statusTone(t.status)}               // a function call
{t.file.split('/').pop()}            // a member chain
{`${prefix}-${id}`}                  // template interpolation
{count + 1}                          // arithmetic
{(() => 'x')()}                      // an IIFE
{await loadRows()}                   // await
{new Date().toISOString()}           // new
```

## Where `const` is looked up — and where it is not

Two scopes only:

1. **Module level** — outside the default export.
2. **The top level of the default export function body.**

A `const` declared inside a nested block, an `if`, a loop, or a callback is
**not** in the table. Hoist it.

```tsx
export default function Report() {
  const rows = [['a', '1']];          // ✅ looked up

  if (rows.length > 0) {
    const extra = [['b', '2']];       // ❌ not looked up
  }

  return <Table headers={['k', 'v']} rows={rows} />;
}
```

Data imported from another module is also not looked up. Inline it as a literal.

## The supported `map` shape

Exactly one form: `STATIC_ARRAY.map(param => LITERAL)`.

```tsx
const tasks = [
  { id: '1', title: 'Registry fix', status: 'complete' },
  { id: '2', title: 'sync_all fix', status: 'open' },
];

// ✅ projection to a row of scalars
rows={tasks.map(t => [t.id, t.title, t.status])}

// ✅ projection to a row, with a const holding the derived values
const tones = ['success', 'warning'];
rowTone={tones}

// ❌ a conditional inside the callback
rows={tasks.map(t => [t.id, t.status === 'complete' ? '完成' : '进行中'])}
```

To get a conditional value, **precompute the literal array**. This is the fix for
the most common "my prop silently vanished" bug:

```tsx
const statusLabel = ['完成', '进行中'];   // precomputed by you, not by the runtime
const statusTone  = ['success', 'warning'];
rows={tasks.map((t, i) => [t.id, statusLabel[i]])}
rowTone={statusTone}
```

`undefined` is a legal element in such an array and means "use the default", so
`rowTone={['accent', undefined, undefined]}` is idiomatic.

## How each failure degrades

Two different failures take two different paths. Knowing which you are looking at
tells you where to look.

| Failure | Result | Visible? |
|---|---|---|
| Non-literal **child** | `unsupported` notice replacing that subtree | ✅ yellow notice |
| Non-literal **prop** | Prop dropped, its name recorded | ❌ silent |
| Unsupported **tag** | Dashed box captioned with the tag name | ✅ dashed box |
| No default export / no JSX root / unterminated JSX | Whole file fails to parse | ✅ error panel |

A silent prop drop is the dangerous one, because the element still renders and
looks *almost* right. If a table lost a column, or a tone did nothing, suspect a
non-literal prop before anything else.

## The syntax trap that blanks a file

JSX treats `{` as the start of an expression container. Prose that contains
braces — very common in reports about code, or about a Python `dict` — becomes
JavaScript and usually fails to parse:

```tsx
{/* ❌ the braces are read as an object literal; `...` is a spread operator */}
<Callout>sync.py 中 int 与 dict 相加（0 + {'created': ...}）导致 TypeError</Callout>

{/* ✅ escape them, or wrap the whole sentence in a string expression */}
<Callout>sync.py 中 int 与 dict 相加（0 + {'{'}created{'}'}: ...）导致 TypeError</Callout>
<Callout>{'sync.py 中 int 与 dict 相加（0 + {\'created\': ...}）导致 TypeError'}</Callout>
```

This is not hypothetical: a real corpus file shipped this error in two
consecutive revisions. A strict compiler rejects the whole file; a
recovering parser renders the rest and degrades the one node.
