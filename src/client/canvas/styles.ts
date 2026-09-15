/**
 * Stylesheet for a rendered canvas document.
 *
 * Two deliberate departures from the plugin's own rules, both because this
 * subtree is a *document*, not plugin chrome:
 *
 * 1. **Literal colours, not `--dsw-alias-*` tokens.** A `.canvas.tsx` encodes a
 *    fixed paper layout; re-tinting it per skin would change what the report
 *    looks like, which is exactly what the author did not ask for. The tokens
 *    stay mandatory for the tab shell around it.
 * 2. **Every selector is scoped under `.dsh-canvas-doc`.** The document tree
 *    lands inside the DSH sidebar, so bare `.card` / `.table` / `.grid` rules
 *    would leak into the host UI. `*` and `img` are the two that must be
 *    rewritten rather than prefixed.
 *
 * Kept as a string (not a CSS module) so the same source drives both the
 * sidebar subtree and the standalone `.rendered.html` export.
 */

/** Root class of a rendered document. */
export const CANVAS_ROOT_CLASS = 'dsh-canvas-doc'

/** Scoped stylesheet; inject once per document. */
export const CANVAS_CSS = `
.dsh-canvas-doc, .dsh-canvas-doc * { box-sizing: border-box; margin: 0; padding: 0; }
.dsh-canvas-doc img { max-width: 100%; height: auto; }
.dsh-canvas-doc {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #111827;
  line-height: 1.6;
  font-size: 14px;
  text-align: left;
}

/* ── page + shell ─────────────────────────────────────────────────────── */
.dsh-canvas-doc .page-wrap { max-width: 780px; margin: 0 auto; padding: 20px; }
.dsh-canvas-doc .report-shell {
  background: #fff; border-radius: 8px; border: 1px solid #d1d5db;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 20px 24px; overflow: hidden;
}

/* ── layout ───────────────────────────────────────────────────────────── */
.dsh-canvas-doc .stack { display: flex; flex-direction: column; }
.dsh-canvas-doc .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.dsh-canvas-doc .row { display: flex; gap: 12px; }
.dsh-canvas-doc .column { flex: 1; min-width: 0; }
/* A 4-column grid drops straight to 2 columns — never through 3. */
@media (max-width: 640px) { .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
@media (max-width: 480px) { .dsh-canvas-doc .grid-3, .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }

/* ── headings + text ──────────────────────────────────────────────────── */
.dsh-canvas-doc .h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
.dsh-canvas-doc .h2 { font-size: 1.25rem; font-weight: 600; color: #111827; margin: 24px 0 6px 0; line-height: 1.3; }
.dsh-canvas-doc .h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 16px 0 4px 0; }
.dsh-canvas-doc .text { font-size: 0.875rem; color: #374151; }
.dsh-canvas-doc .text-secondary { color: #6b7280; }
.dsh-canvas-doc .text-small, .dsh-canvas-doc .text-sm { font-size: 0.75rem; }
.dsh-canvas-doc .p { font-size: 0.875rem; color: #374151; line-height: 1.6; margin-bottom: 12px; }

/* ── section ──────────────────────────────────────────────────────────── */
.dsh-canvas-doc .report-section { margin-bottom: 24px; }
.dsh-canvas-doc .section-header { margin-bottom: 12px; }
.dsh-canvas-doc .section-title { font-size: 1.1rem; font-weight: 600; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
.dsh-canvas-doc .section-desc { font-size: 0.875rem; color: #6b7280; margin-top: 4px; }

/* ── stat + metrics ───────────────────────────────────────────────────── */
.dsh-canvas-doc .stat { text-align: center; padding: 12px 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
.dsh-canvas-doc .stat-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
.dsh-canvas-doc .stat-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
.dsh-canvas-doc .metrics-grid { display: grid; gap: 16px; margin-bottom: 16px; }
.dsh-canvas-doc .metric-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
.dsh-canvas-doc .metric-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
.dsh-canvas-doc .metric-label { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }

/* ── table ────────────────────────────────────────────────────────────── */
.dsh-canvas-doc .table-wrap { overflow-x: auto; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
.dsh-canvas-doc .table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.dsh-canvas-doc .th { padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
.dsh-canvas-doc .td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
.dsh-canvas-doc .tr-success { background: #f0fdf4; }
.dsh-canvas-doc .tr-success .td { border-bottom-color: #bbf7d0; }
.dsh-canvas-doc .tr-warning { background: #fffbeb; }
.dsh-canvas-doc .tr-warning .td { border-bottom-color: #fde68a; }
.dsh-canvas-doc .tr-danger { background: #fef2f2; }
.dsh-canvas-doc .tr-danger .td { border-bottom-color: #fecaca; }
.dsh-canvas-doc .tr-accent { background: #eff6ff; }
.dsh-canvas-doc .tr-muted { background: #f9fafb; }

/* ── card ─────────────────────────────────────────────────────────────── */
.dsh-canvas-doc .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; background: #fff; }
.dsh-canvas-doc .card-header { font-weight: 600; margin-bottom: 8px; }
.dsh-canvas-doc .card-subtitle { font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; }

/* ── callout + banner ─────────────────────────────────────────────────── */
.dsh-canvas-doc .callout, .dsh-canvas-doc .banner { border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
.dsh-canvas-doc .callout-info { border-left: 4px solid #3b82f6; background: #eff6ff; }
.dsh-canvas-doc .callout-success { border-left: 4px solid #22c55e; background: #f0fdf4; }
.dsh-canvas-doc .callout-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
.dsh-canvas-doc .callout-danger { border-left: 4px solid #ef4444; background: #fef2f2; }
.dsh-canvas-doc .callout-neutral { border-left: 4px solid #6b7280; background: #f9fafb; }
.dsh-canvas-doc .callout-title { font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.dsh-canvas-doc .callout-icon { font-size: 1rem; line-height: 1; }
.dsh-canvas-doc .callout-body { color: #374151; }

/* ── pill / tag / badge / code ────────────────────────────────────────── */
.dsh-canvas-doc .pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; margin-right: 4px; }
.dsh-canvas-doc .pill-green, .dsh-canvas-doc .pill-success { background: #dcfce7; color: #166534; }
.dsh-canvas-doc .pill-red, .dsh-canvas-doc .pill-danger { background: #fee2e2; color: #991b1b; }
.dsh-canvas-doc .pill-yellow, .dsh-canvas-doc .pill-warning { background: #fef9c3; color: #854d0e; }
.dsh-canvas-doc .pill-blue, .dsh-canvas-doc .pill-info { background: #dbeafe; color: #1e40af; }
.dsh-canvas-doc .pill-gray, .dsh-canvas-doc .pill-neutral { background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .tag { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
.dsh-canvas-doc .tag-success { background: #dcfce7; color: #166534; }
.dsh-canvas-doc .tag-danger { background: #fee2e2; color: #991b1b; }
.dsh-canvas-doc .tag-warning { background: #fef9c3; color: #854d0e; }
.dsh-canvas-doc .tag-info { background: #dbeafe; color: #1e40af; }
.dsh-canvas-doc .tag-neutral { background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
.dsh-canvas-doc .pre { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap; }
.dsh-canvas-doc .link { color: #2563eb; text-decoration: none; }
.dsh-canvas-doc .link:hover { text-decoration: underline; }

/* ── timeline ─────────────────────────────────────────────────────────── */
.dsh-canvas-doc .timeline { border-left: 2px solid #e5e7eb; padding-left: 20px; margin-bottom: 16px; }
.dsh-canvas-doc .timeline-item { margin-bottom: 16px; position: relative; }
.dsh-canvas-doc .timeline-dot { position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; border: 2px solid #fff; box-shadow: 0 0 0 2px #e5e7eb; }
.dsh-canvas-doc .timeline-time { font-size: 0.75rem; color: #6b7280; margin-bottom: 2px; }
.dsh-canvas-doc .timeline-title { font-size: 0.9375rem; font-weight: 600; color: #111827; margin-bottom: 4px; }
.dsh-canvas-doc .timeline-desc { font-size: 0.8125rem; color: #6b7280; line-height: 1.5; }

/* ── key/value + steps ────────────────────────────────────────────────── */
.dsh-canvas-doc .kv-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
.dsh-canvas-doc .kv-label { color: #6b7280; }
.dsh-canvas-doc .kv-value { color: #111827; font-weight: 500; }
.dsh-canvas-doc .steps { margin-bottom: 16px; }
.dsh-canvas-doc .step { display: flex; gap: 12px; margin-bottom: 8px; }
.dsh-canvas-doc .step-num { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
.dsh-canvas-doc .step-text { font-size: 0.875rem; color: #374151; padding-top: 2px; }

.dsh-canvas-doc .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

/* ── images ───────────────────────────────────────────────────────────── */
.dsh-canvas-doc .canvas-image { margin: 0 0 16px 0; max-width: 100%; overflow: hidden; }
.dsh-canvas-doc .canvas-image img { display: block; width: 100%; max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; }
.dsh-canvas-doc .img-caption { font-size: 0.8125rem; color: #6b7280; margin-top: 6px; text-align: left; }
.dsh-canvas-doc .canvas-image-placeholder { margin: 0 0 16px 0; max-width: 100%; }
.dsh-canvas-doc .img-placeholder-box { background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; padding: 32px; text-align: center; color: #6b7280; font-size: 0.875rem; }

/* ── evidence methodology ─────────────────────────────────────────────── */
.dsh-canvas-doc .evidence-methodology { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; background: #fafbfc; }
.dsh-canvas-doc .evi-title { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 8px; }
.dsh-canvas-doc .evi-summary { font-size: 0.875rem; color: #374151; margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e; }
.dsh-canvas-doc .evi-overview { font-size: 0.8125rem; color: #6b7280; margin-bottom: 12px; }
.dsh-canvas-doc .evi-meta { margin-bottom: 12px; }
.dsh-canvas-doc .evi-group { margin-bottom: 12px; }
.dsh-canvas-doc .evi-group-title { font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
.dsh-canvas-doc .evi-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.8125rem; }
.dsh-canvas-doc .evi-item-label { color: #6b7280; flex: 1; }
.dsh-canvas-doc .evi-item-value { color: #16a34a; font-weight: 500; text-align: right; flex: 1; }
.dsh-canvas-doc .evi-accounting { font-size: 0.8125rem; color: #6b7280; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-style: italic; }

/* ── fidelity notices ─────────────────────────────────────────────────── */
.dsh-canvas-doc .unsupported { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 2px 6px; font-size: 0.8125rem; color: #92400e; font-family: monospace; }
.dsh-canvas-doc .unknown-component { border: 1px dashed #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 8px; max-width: 100%; overflow: hidden; }
.dsh-canvas-doc .unknown-component::before { content: "⚠ " attr(data-tag); font-size: 0.75rem; color: #9ca3af; display: block; margin-bottom: 4px; }
`.trim()

/**
 * Standalone page wrapper for the exported `.rendered.html`.
 * Kept separate from {@link CANVAS_CSS} so the embedded (sidebar) build never
 * carries page-level rules.
 */
export const CANVAS_PAGE_CSS = `
html, body { margin: 0; padding: 0; }
body { background: #f5f5f5; overflow-x: hidden; }
`.trim()
