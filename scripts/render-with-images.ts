/**
 * render-with-images.ts
 *
 * 在 render-test.ts 基础上，对 canvasImage 引用的图片做 base64 嵌入。
 * 用法: node --import tsx scripts/render-with-images.ts <canvas-file>
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { basename, dirname, join, extname } from 'path';
import { extractCanvas } from '../src/client/canvas/extract';
import type { CanvasNode } from '../src/client/canvas/ir';

// ─── 图片路径解析 + base64 ───

function resolveAndEmbed(src: string, canvasDir: string): { dataUri: string | null; caption: string } {
  if (!src) return { dataUri: null, caption: '' };

  // data: 或 http 直接返回
  if (src.startsWith('data:') || src.startsWith('http')) {
    return { dataUri: src, caption: '' };
  }

  // 解析相对路径
  const candidates = [
    join(canvasDir, src),
    join(canvasDir, '..', src),
  ];

  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) {
      try {
        const buf = readFileSync(c);
        const ext = extname(c).toLowerCase();
        const mime: Record<string, string> = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        };
        const m = mime[ext] || 'image/png';
        const b64 = buf.toString('base64');
        return { dataUri: `data:${m};base64,${b64}`, caption: `${basename(c)} (${(buf.length / 1024).toFixed(0)} KB)` };
      } catch { /* 继续 */ }
    }
  }

  return { dataUri: null, caption: src + ' (未找到)' };
}

// ─── 扫描 canvas 源码中的 canvasImage 调用，建立两层映射 ───
// 1. varName → dataUri（如 home → data:image/png;base64,...）
// 2. refPath → dataUri（如 ./igw-01-home.png → data:image/png;base64,...）

function buildImageMaps(source: string, canvasDir: string): { varMap: Map<string, string>; refMap: Map<string, string> } {
  const varMap = new Map<string, string>();
  const refMap = new Map<string, string>();

  // 匹配 const xxx = canvasImage('./path')
  const re = /const\s+(\w+)\s*=\s*canvasImage\(['"]([^'"]+)['"]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const varName = m[1];  // e.g. "home"
    const ref = m[2];      // e.g. "./igw-01-home.png"
    const { dataUri } = resolveAndEmbed(ref, canvasDir);
    if (dataUri) {
      varMap.set(varName, dataUri);
      refMap.set(ref, dataUri);
    }
  }
  return { varMap, refMap };
}

// ─── 从源码提取 <img src={varName} 的顺序映射 ───
// 因为 IR 中 src 是 unresolved，需要从源码推断哪个 img 对应哪个变量

function buildImgOrder(source: string): string[] {
  const re = /<img\s+[^>]*src=\{(\w+)\}/g;
  const order: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    order.push(m[1]);
  }
  return order;
}

// ─── IR → HTML（带图片替换） ───

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function irToHtml(node: CanvasNode, varMap: Map<string, string>, imgOrder: string[], imgIndex: { current: number }, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (node.kind === 'text') return esc(node.value || '');
  if (node.kind === 'unsupported') {
    return `${pad}<span class="unsupported">${esc(node.snippet || '...')}</span>`;
  }

  const tag = node.tag || 'div';
  const props = node.props || {};
  const ch = (node.children || []).map(c => irToHtml(c, varMap, imgOrder, imgIndex, indent + 1)).join('\n');

  switch (tag) {
    // ─── 布局 ───
    case 'ReportShell':
      return `${pad}<div class="report-shell">\n${ch}\n${pad}</div>`;
    case 'Stack': {
      const gap = props.gap === 'section' ? '24px' : props.gap === 'component' ? '12px' : typeof props.gap === 'number' ? `${props.gap}px` : '8px';
      return `${pad}<div class="stack" style="display:flex;flex-direction:column;gap:${gap}">\n${ch}\n${pad}</div>`;
    }
    case 'Grid': {
      const cols = (props.columns || 2) as number;
      const g = typeof props.gap === 'number' ? `${props.gap}px` : '16px';
      // 固定列数 + 媒体查询断点：宽屏4列，≤640px直接2列
      return `${pad}<div class="grid grid-${cols}" style="grid-template-columns:repeat(${cols}, 1fr);gap:${g}">\n${ch}\n${pad}</div>`;
    }
    case 'Row': {
      const align = props.align === 'center' ? 'center' : props.align === 'end' ? 'flex-end' : 'flex-start';
      return `${pad}<div class="row" style="display:flex;gap:12px;align-items:${align}">\n${ch}\n${pad}</div>`;
    }
    case 'Column':
      return `${pad}<div class="column" style="flex:1;min-width:0">\n${ch}\n${pad}</div>`;
    case 'ReportSection': {
      const title = props.title ? esc(String(props.title)) : '';
      const desc = props.description ? `\n${pad}  <p class="section-desc">${esc(String(props.description))}</p>` : '';
      return `${pad}<section class="report-section">\n${pad}  <div class="section-header">\n${pad}    <h2 class="section-title">${title}</h2>${desc}\n${pad}  </div>\n${pad}  <div class="section-body">\n${ch}\n${pad}  </div>\n${pad}</section>`;
    }

    // ─── 标题 ───
    case 'H1': return `${pad}<h1 class="h1">${ch}</h1>`;
    case 'H2': return `${pad}<h2 class="h2">${ch}</h2>`;
    case 'H3': return `${pad}<h3 class="h3">${ch}</h3>`;

    // ─── 文本 ───
    case 'Text': {
      const tone = props.tone as string || '';
      const size = props.size as string || '';
      const cls = ['text', tone ? `text-${tone}` : '', size ? `text-${size}` : ''].filter(Boolean).join(' ');
      return `${pad}<span class="${cls}">${ch}</span>`;
    }
    case 'P': return `${pad}<p class="p">${ch}</p>`;
    case 'Pill': {
      const color = (props.color || props.tone || 'gray') as string;
      return `${pad}<span class="pill pill-${color}">${ch}</span>`;
    }
    case 'Tag': {
      const tone = (props.tone || 'neutral') as string;
      return `${pad}<span class="tag tag-${tone}">${ch}</span>`;
    }
    case 'Badge':
      return `${pad}<span class="badge">${ch}</span>`;
    case 'Code':
      return `<code class="code">${ch}</code>`;
    case 'Pre':
      return `<pre class="pre"><code>${ch}</code></pre>`;
    case 'Link':
      return `<a class="link" href="${esc(String(props.href || '#'))}">${ch}</a>`;

    // ─── 数据展示 ───
    case 'Table': {
      const cols = (props.columns || []) as any[];
      const headers = (props.headers || []) as any[];
      const data = (props.data || []) as any[];
      const rows = (props.rows || []) as any[];
      const rowToneRaw = props.rowTone;
      const rowTones: string[] = [];
      if (Array.isArray(rowToneRaw)) rowToneRaw.forEach((t: any) => rowTones.push(String(t || '')));
      else if (typeof rowToneRaw === 'string') data.forEach(() => rowTones.push(rowToneRaw));

      let colDefs: { label: string; key: string }[] = [];
      let rowData: Record<string, any>[] = [];
      if (cols.length > 0 && data.length > 0) {
        colDefs = cols.map((c: any) => ({ label: c.label || c.key || c.title || '', key: c.key }));
        rowData = data;
      } else if (headers.length > 0 && rows.length > 0) {
        colDefs = headers.map((h: string, i: number) => ({ label: h, key: `_${i}` }));
        rowData = rows.map((row: any[]) => {
          const obj: Record<string, any> = {};
          row.forEach((val: any, i: number) => { obj[`_${i}`] = val; });
          return obj;
        });
      }
      if (colDefs.length === 0) return ch;
      const ths = colDefs.map(c => `<th class="th">${esc(c.label)}</th>`).join('');
      const trs = rowData.map((row, ri) => {
        const tone = rowTones[ri] || '';
        const cls = tone ? `tr tr-${tone}` : 'tr';
        return `<tr class="${cls}">${colDefs.map(c => `<td class="td">${esc(String(row[c.key] ?? ''))}</td>`).join('')}</tr>`;
      }).join('\n');
      return `${pad}<div class="table-wrap">\n${pad}  <table class="table">\n${pad}    <thead><tr>${ths}</tr></thead>\n${pad}    <tbody>\n${pad}      ${trs}\n${pad}    </tbody>\n${pad}  </table>\n${pad}</div>`;
    }
    case 'Stat': {
      const value = esc(String(props.value || ''));
      const label = esc(String(props.label || ''));
      const tone = (props.tone || 'default') as string;
      const valueColors: Record<string, string> = {
        success: '#16a34a', danger: '#dc2626', warning: '#d97706',
        info: '#2563eb', primary: '#2563eb', neutral: '#111827', ok: '#16a34a',
      };
      const vColor = valueColors[tone] || '#111827';
      return `${pad}<div class="stat">\n${pad}  <div class="stat-label">${label}</div>\n${pad}  <div class="stat-value" style="color:${vColor}">${value}</div>\n${pad}</div>`;
    }
    case 'MetricsGrid': {
      const metrics = (props.metrics || props.items || []) as any[];
      const cols = (props.cols || 3) as number;
      const minW = cols <= 2 ? '200px' : cols <= 3 ? '200px' : '240px';
      const cards = metrics.map(m =>
        `<div class="metric-card"><div class="metric-value">${esc(String(m.value || ''))}</div><div class="metric-label">${esc(m.label || '')}</div></div>`
      ).join('\n');
      return `${pad}<div class="metrics-grid" style="grid-template-columns:repeat(auto-fit, minmax(${minW}, 1fr))">\n${pad}  ${cards}\n${pad}</div>`;
    }
    case 'Timeline': {
      const items = (props.items || props.events || []) as any[];
      const lis = items.map(item => {
        const time = item.timestamp || item.time || '';
        const title = item.title || '';
        const desc = item.description || '';
        const state = item.state || '';
        const dotColor = state === 'completed' ? '#3b82f6' : state === 'current' ? '#f59e0b' : '#d1d5db';
        return `<div class="timeline-item"><div class="timeline-dot" style="background:${dotColor}"></div><div class="timeline-content"><div class="timeline-time">${esc(String(time))}</div><div class="timeline-title">${esc(String(title))}</div>${desc ? `<div class="timeline-desc">${esc(String(desc))}</div>` : ''}</div></div>`;
      }).join('\n');
      return `${pad}<div class="timeline">\n${pad}  ${lis}\n${pad}</div>`;
    }
    case 'KeyValue': {
      const items = (props.items || props.data || []) as any[];
      if (items.length) {
        return items.map((item: any) =>
          `<div class="kv-row"><span class="kv-label">${esc(item.label || '')}</span><span class="kv-value">${esc(String(item.value ?? ''))}</span></div>`
        ).join('\n');
      }
      return `${pad}<div class="kv-row"><span class="kv-label">${esc(String(props.label || ''))}</span><span class="kv-value">${ch}</span></div>`;
    }
    case 'Card': {
      const sub = props.subtitle ? `\n${pad}  <p class="card-subtitle">${esc(String(props.subtitle))}</p>` : '';
      return `${pad}<div class="card">${sub}\n${ch}\n${pad}</div>`;
    }
    case 'CardHeader': {
      const title = props.title ? `\n${pad}  <div class="card-header-title">${esc(String(props.title))}</div>` : '';
      return `${pad}<div class="card-header">${title}${ch}\n${pad}</div>`;
    }
    case 'CardBody':
      return `${pad}<div class="card-body">${ch}\n${pad}</div>`;

    // ─── 提示 ───
    case 'Callout': {
      const tone = (props.tone || props.type || 'info') as string;
      const icons: Record<string, string> = { info: 'ℹ️', warning: '⚠️', danger: '🔴', success: '✅', neutral: '•', positive: '✅', caution: '⚠️', critical: '🔴' };
      const icon = icons[tone] || 'ℹ️';
      const title = props.title ? `\n${pad}  <div class="callout-title"><span class="callout-icon">${icon}</span> ${esc(String(props.title))}</div>` : '';
      return `${pad}<div class="callout callout-${tone}">${title}\n${pad}  <div class="callout-body">${ch}</div>\n${pad}</div>`;
    }
    case 'Banner': {
      const tone = (props.tone || props.type || 'info') as string;
      const icons: Record<string, string> = { info: 'ℹ️', warning: '⚠️', danger: '🔴', success: '✅', neutral: '•', positive: '✅', caution: '⚠️', critical: '🔴' };
      const icon = icons[tone] || 'ℹ️';
      const title = props.title ? `\n${pad}  <div class="callout-title"><span class="callout-icon">${icon}</span> ${esc(String(props.title))}</div>` : '';
      return `${pad}<div class="banner callout-${tone}">${title}\n${pad}  <div class="callout-body">${ch}</div>\n${pad}</div>`;
    }

    // ─── 分隔 ───
    case 'Separator': case 'Divider':
      return `<hr class="divider" />`;

    // ─── 步骤 ───
    case 'Steps': {
      const items = (props.items || []) as any[];
      const steps = items.map((item: any, i: number) =>
        `<div class="step"><div class="step-num">${i + 1}</div><div class="step-text">${esc(item.text || '')}</div></div>`
      ).join('\n');
      return `${pad}<div class="steps">\n${pad}  ${steps}\n${pad}</div>`;
    }

    // ─── EvidenceMethodology ───
    case 'EvidenceMethodology': {
      const title = props.title ? `\n${pad}  <h3 class="evi-title">${esc(String(props.title))}</h3>` : '';
      const summary = props.summary ? `\n${pad}  <div class="evi-summary">${esc(String(props.summary))}</div>` : '';
      const overview = props.overview ? `\n${pad}  <div class="evi-overview"><strong>验证流程：</strong>${esc(String(props.overview))}</div>` : '';
      const meta = (props.metadata || []) as any[];
      let metaHtml = '';
      if (meta.length) {
        metaHtml = `\n${pad}  <table class="table evi-meta"><thead><tr><th class="th">模块</th><th class="th">结果</th></tr></thead><tbody>`;
        for (const item of meta) metaHtml += `\n${pad}    <tr class="tr tr-success"><td class="td">${esc(String(item.label || ''))}</td><td class="td">${esc(String(item.value || ''))}</td></tr>`;
        metaHtml += `\n${pad}  </tbody></table>`;
      }
      const groups = (props.groups || []) as any[];
      let groupsHtml = '';
      for (const g of groups) {
        groupsHtml += `\n${pad}  <div class="evi-group"><div class="evi-group-title">${esc(String(g.title || ''))}</div>`;
        for (const item of (g.items || []))
          groupsHtml += `\n${pad}    <div class="evi-item"><span class="evi-item-label">${esc(String(item.label || ''))}</span><span class="evi-item-value">${esc(String(item.value || ''))}</span></div>`;
        groupsHtml += `\n${pad}  </div>`;
      }
      const accounting = props.accounting ? `\n${pad}  <div class="evi-accounting"><strong>审计说明：</strong>${esc(String(props.accounting))}</div>` : '';
      return `${pad}<div class="evidence-methodology">${title}${summary}${overview}${metaHtml}${groupsHtml}${accounting}\n${pad}</div>`;
    }

    // ─── 截图（带 base64 嵌入） ───
    case 'img': {
      const alt = (props.alt || props.title || '截图') as string;

      // 按顺序从 imgOrder 取变量名，查 varMap 得 dataUri
      let dataUri: string | null = null;
      if (imgIndex.current < imgOrder.length) {
        const varName = imgOrder[imgIndex.current];
        dataUri = varMap.get(varName) || null;
        imgIndex.current++;
      }

      if (dataUri) {
        return `${pad}<figure class="canvas-image">\n${pad}  <img src="${dataUri}" alt="${esc(alt)}" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb" loading="lazy" />\n${pad}  <figcaption class="img-caption">${esc(alt)}</figcaption>\n${pad}</figure>`;
      }
      return `${pad}<figure class="canvas-image-placeholder">\n${pad}  <div class="img-placeholder-box">📷 ${esc(alt)}</div>\n${pad}  <figcaption class="img-caption">(图片未嵌入)</figcaption>\n${pad}</figure>`;
    }

    // ─── 未知组件 → 透明容器 ───
    default:
      return `${pad}<div class="unknown-component" data-tag="${esc(tag)}">\n${ch}\n${pad}</div>`;
  }
}

// ─── CSS ───

const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    img { max-width: 100%; height: auto; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #111827; line-height: 1.6; overflow-x: hidden; }
    .page-wrap { max-width: 780px; margin: 0 auto; padding: 20px; }
    .report-shell { background: #fff; border-radius: 8px; border: 1px solid #d1d5db; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 20px 24px; overflow: hidden; }
    .stack { display: flex; flex-direction: column; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    /* 4列网格：宽屏4列，窄屏直接2列，跳过3列 */
    @media (max-width: 640px) { .grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
    @media (max-width: 480px) { .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
    .row { display: flex; gap: 12px; }
    .column { flex: 1; min-width: 0; }
    .h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
    .h2 { font-size: 1.25rem; font-weight: 600; color: #111827; margin: 24px 0 6px 0; line-height: 1.3; }
    .h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 16px 0 4px 0; }
    .text { font-size: 0.875rem; color: #374151; }
    .text-secondary { color: #6b7280; }
    .text-small, .text-sm { font-size: 0.75rem; }
    .p { font-size: 0.875rem; color: #374151; line-height: 1.6; margin-bottom: 12px; }
    .report-section { margin-bottom: 24px; }
    .section-header { margin-bottom: 12px; }
    .section-title { font-size: 1.1rem; font-weight: 600; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
    .section-desc { font-size: 0.875rem; color: #6b7280; margin-top: 4px; }
    .stat { text-align: center; padding: 12px 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .stat-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
    .table-wrap { overflow-x: auto; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .th { padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
    .td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    .tr-success { background: #f0fdf4; } .tr-success .td { border-bottom-color: #bbf7d0; }
    .tr-warning { background: #fffbeb; } .tr-warning .td { border-bottom-color: #fde68a; }
    .tr-danger { background: #fef2f2; } .tr-danger .td { border-bottom-color: #fecaca; }
    .tr-accent { background: #eff6ff; }
    .tr-muted { background: #f9fafb; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; background: #fff; }
    .card-header { font-weight: 600; margin-bottom: 8px; }
    .card-body { }
    .card-subtitle { font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; }
    .callout { border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
    .callout-info { border-left: 4px solid #3b82f6; background: #eff6ff; }
    .callout-success { border-left: 4px solid #22c55e; background: #f0fdf4; }
    .callout-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .callout-danger { border-left: 4px solid #ef4444; background: #fef2f2; }
    .callout-neutral { border-left: 4px solid #6b7280; background: #f9fafb; }
    .callout-title { font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .callout-icon { font-size: 1rem; line-height: 1; }
    .callout-body { color: #374151; }
    .banner { border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; margin-right: 4px; }
    .pill-green, .pill-success { background: #dcfce7; color: #166534; }
    .pill-red, .pill-danger { background: #fee2e2; color: #991b1b; }
    .pill-yellow, .pill-warning { background: #fef9c3; color: #854d0e; }
    .pill-blue, .pill-info { background: #dbeafe; color: #1e40af; }
    .pill-gray, .pill-neutral { background: #f3f4f6; color: #374151; }
    .tag { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .tag-success { background: #dcfce7; color: #166534; }
    .tag-danger { background: #fee2e2; color: #991b1b; }
    .tag-warning { background: #fef9c3; color: #854d0e; }
    .tag-info { background: #dbeafe; color: #1e40af; }
    .tag-neutral { background: #f3f4f6; color: #374151; }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #374151; }
    .code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    .pre { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap; }
    .timeline { border-left: 2px solid #e5e7eb; padding-left: 20px; margin-bottom: 16px; }
    .timeline-item { margin-bottom: 16px; position: relative; }
    .timeline-dot { position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; border: 2px solid #fff; box-shadow: 0 0 0 2px #e5e7eb; }
    .timeline-time { font-size: 0.75rem; color: #6b7280; margin-bottom: 2px; }
    .timeline-title { font-size: 0.9375rem; font-weight: 600; color: #111827; margin-bottom: 4px; }
    .timeline-desc { font-size: 0.8125rem; color: #6b7280; line-height: 1.5; }
    .metrics-grid { display: grid; gap: 16px; margin-bottom: 16px; }
    .metric-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .metric-label { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }
    .kv-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
    .kv-label { color: #6b7280; }
    .kv-value { color: #111827; font-weight: 500; }
    .steps { margin-bottom: 16px; }
    .step { display: flex; gap: 12px; margin-bottom: 8px; }
    .step-num { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .step-text { font-size: 0.875rem; color: #374151; padding-top: 2px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .canvas-image { margin: 0 0 16px 0; max-width: 100%; overflow: hidden; }
    .canvas-image img { display: block; width: 100%; max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; }
    .img-caption { font-size: 0.8125rem; color: #6b7280; margin-top: 6px; text-align: left; }
    .canvas-image-placeholder { margin: 0 0 16px 0; max-width: 100%; }
    .img-placeholder-box { background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; padding: 32px; text-align: center; color: #6b7280; font-size: 0.875rem; }
    .unknown-component { max-width: 100%; overflow: hidden; }
    .evidence-methodology { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; background: #fafbfc; }
    .evi-title { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 8px; }
    .evi-summary { font-size: 0.875rem; color: #374151; margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e; }
    .evi-overview { font-size: 0.8125rem; color: #6b7280; margin-bottom: 12px; }
    .evi-meta { margin-bottom: 12px; }
    .evi-group { margin-bottom: 12px; }
    .evi-group-title { font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .evi-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.8125rem; }
    .evi-item-label { color: #6b7280; flex: 1; }
    .evi-item-value { color: #16a34a; font-weight: 500; text-align: right; flex: 1; }
    .evi-accounting { font-size: 0.8125rem; color: #6b7280; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-style: italic; }
    .unsupported { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 2px 6px; font-size: 0.8125rem; color: #92400e; font-family: monospace; }
    .unknown-component { border: 1px dashed #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
    .unknown-component::before { content: "⚠ " attr(data-tag); font-size: 0.75rem; color: #9ca3af; display: block; margin-bottom: 4px; }
`;

// ─── 主流程 ───

function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error('Usage: node --import tsx scripts/render-with-images.ts <canvas-file>'); process.exit(1); }

  const src = readFileSync(filePath, 'utf-8');
  const srcBytes = Buffer.byteLength(src, 'utf-8');
  const name = basename(filePath).replace('.canvas.tsx', '');
  const canvasDir = dirname(filePath);

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  渲染(含图片嵌入): ${basename(filePath)}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // 构建图片 base64 映射（变量名 → dataUri）
  const { varMap } = buildImageMaps(src, canvasDir);
  const imgOrder = buildImgOrder(src);
  console.log('图片映射: ' + varMap.size + ' 个已嵌入');
  for (const [varName] of varMap) console.log('  ✅ ' + varName);
  console.log('img 顺序: ' + imgOrder.join(', '));

  // 解析
  const result = extractCanvas(src);
  if (!result.root) { console.error('❌ 解析失败'); process.exit(1); }

  let components = 0, textNodes = 0;
  function walk(n: CanvasNode) {
    if (n.kind === 'element') { components++; if (n.children) n.children.forEach(walk); }
    else if (n.kind === 'text') textNodes++;
  }
  walk(result.root);
  console.log(`IR: ${components} 组件 + ${textNodes} 文本节点`);

  // 检查根节点是否已经是 ReportShell
  const hasReportShell = result.root.kind === 'element' && result.root.tag === 'ReportShell';

  // 渲染
  const bodyHtml = irToHtml(result.root, varMap, imgOrder, { current: 0 });

  // 包装：如果没有 ReportShell，模板强制包一层
  const shellOpen = hasReportShell ? '' : '<div class="report-shell">';
  const shellClose = hasReportShell ? '' : '</div>';

  // 包装

  // 包装
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="page-wrap">
${shellOpen}
${bodyHtml}
${shellClose}
</div>
</body>
</html>`;

  const outPath = join(canvasDir, `${name}.rendered.html`);
  writeFileSync(outPath, fullHtml, 'utf-8');

  const htmlBytes = Buffer.byteLength(fullHtml, 'utf-8');
  console.log(`\nHTML: ${htmlBytes} B (含 CSS + base64 图片)`);
  console.log(`比率: ${(htmlBytes / srcBytes).toFixed(2)}x`);
  console.log(`📄 ${outPath}`);
}

main();
