/**
 * render-test.ts
 *
 * 端到端转换测试：真实 .canvas.tsx → IR → HTML
 * 用法: node --import tsx scripts/render-test.ts <path-to-canvas.tsx>
 *
 * 产出:
 *   1. 控制台输出：解析统计 + IR 摘要
 *   2. 同目录输出：<name>.rendered.html（可直接浏览器打开）
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { extractCanvas } from '../src/client/canvas/extract';
import type { CanvasNode, CanvasProp } from '../src/client/canvas/ir';

// ─── 图片路径解析 ───
let CANVAS_DIR = '';

function resolveImagePath(src: string): string | null {
  if (!CANVAS_DIR) return null;
  const { existsSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  // 绝对路径
  if (src.startsWith('/') || /^[A-Z]:/i.test(src)) {
    return existsSync(src) ? src : null;
  }
  // 相对路径 → 相对于 canvas 文件目录
  const resolved = join(CANVAS_DIR, src);
  if (existsSync(resolved)) return resolved;
  // 也试 canvasDir 的上级目录
  const parent = join(CANVAS_DIR, '..');
  const resolved2 = join(parent, src);
  if (existsSync(resolved2)) return resolved2;
  return null;
}

// ─── HTML 序列化器（完整版，含所有 21 个组件） ───

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeProps(props: Record<string, CanvasProp>): string {
  return Object.entries(props)
    .filter(([k, v]) => k !== 'children' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${typeof v === 'string' ? esc(v) : JSON.stringify(v)}"`)
    .join(' ');
}

function irToHtml(node: CanvasNode, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (node.kind === 'text') return esc(node.value || '');
  if (node.kind === 'unsupported') {
    return `${pad}<span class="unsupported" title="解析器降级">${esc(node.snippet || '...')}</span>`;
  }

  const tag = node.tag || 'div';
  const props = node.props || {};
  const ch = (node.children || []).map(c => irToHtml(c, indent + 1)).join('\n');

  switch (tag) {
    // ─── 布局 ───
    case 'ReportShell':
      return `${pad}<div class="report-shell">\n${ch}\n${pad}</div>`;
    case 'Stack': {
      const gap = props.gap === 'section' ? '24px' : props.gap === 'component' ? '12px' : '8px';
      return `${pad}<div class="stack" style="display:flex;flex-direction:column;gap:${gap}">\n${ch}\n${pad}</div>`;
    }
    case 'Grid': {
      const cols = (props.columns || 2) as number;
      const g = (props.gap || 16) as number;
      return `${pad}<div class="grid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${g}px">\n${ch}\n${pad}</div>`;
    }
    case 'Row':
      return `${pad}<div class="row" style="display:flex;gap:16px">\n${ch}\n${pad}</div>`;
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
      const cls = tone ? `text text-${tone}` : 'text';
      return `${pad}<span class="${cls}">${ch}</span>`;
    }
    case 'P': return `${pad}<p class="p">${ch}</p>`;
    case 'Pill': {
      const color = (props.color || props.tone || 'gray') as string;
      return `${pad}<span class="pill pill-${color}">${ch}</span>`;
    }
    case 'Tag': {
      const tone = (props.tone || 'neutral') as string;
      const active = props.active ? ' tag-active' : '';
      return `${pad}<span class="tag tag-${tone}${active}">${ch}</span>`;
    }
    case 'Badge':
      return `${pad}<span class="badge">${ch}</span>`;
    case 'Code':
      return `<code class="code">${ch}</code>`;
    case 'Pre':
      return `<pre class="pre"><code>${ch}</code></pre>`;
    case 'Link':
      return `<a class="link" href="${esc(String(props.href || '#'))}">${ch}</a>`;
    case 'Checkbox': {
      const checked = props.checked ? '✓' : '○';
      return `${pad}<div class="checkbox">${checked} ${ch}</div>`;
    }

    // ─── 数据展示 ───
    case 'Table': {
      // 支持两种格式: columns/data 或 headers/rows
      const cols = (props.columns || []) as any[];
      const headers = (props.headers || []) as any[];
      const data = (props.data || []) as any[];
      const rows = (props.rows || []) as any[];

      // 统一为列定义 + 行数据
      let colDefs: { label: string; key: string }[] = [];
      let rowData: Record<string, any>[] = [];

      if (cols.length > 0 && data.length > 0) {
        // columns/data 格式
        colDefs = cols.map((c: any) => ({ label: c.label || c.key, key: c.key }));
        rowData = data;
      } else if (headers.length > 0 && rows.length > 0) {
        // headers/rows 格式: headers = ['列1','列2',...], rows = [['值1','值2',...], ...]
        colDefs = headers.map((h: string, i: number) => ({ label: h, key: `_${i}` }));
        rowData = rows.map((row: any[]) => {
          const obj: Record<string, any> = {};
          row.forEach((val: any, i: number) => { obj[`_${i}`] = val; });
          return obj;
        });
      }

      // 处理 rowTone 属性（数组或单值）
      const rowToneRaw = props.rowTone;
      const rowTones: string[] = [];
      if (Array.isArray(rowToneRaw)) {
        rowToneRaw.forEach((t: any) => rowTones.push(String(t || '')));
      } else if (typeof rowToneRaw === 'string') {
        rowData.forEach(() => rowTones.push(rowToneRaw));
      }

      if (colDefs.length === 0) return ch; // 无列定义则只渲染子节点

      const ths = colDefs.map(c => `<th class="th">${esc(c.label)}</th>`).join('');
      const trs = rowData.map((row, ri) => {
        const tone = rowTones[ri] || (row as any)._tone || '';
        const cls = tone ? `tr tr-${tone}` : 'tr';
        return `<tr class="${cls}">${colDefs.map(c => `<td class="td">${esc(String(row[c.key] ?? ''))}</td>`).join('')}</tr>`;
      }).join('\n');
      return `${pad}<div class="table-wrap">\n${pad}  <table class="table">\n${pad}    <thead><tr>${ths}</tr></thead>\n${pad}    <tbody>\n${pad}      ${trs}\n${pad}    </tbody>\n${pad}  </table>\n${pad}</div>`;
    }
    case 'Stat': {
      const value = esc(String(props.value || ''));
      const label = esc(String(props.label || ''));
      const tone = (props.tone || 'default') as string;
      // 根据 tone 给值着色
      const valueColors: Record<string, string> = {
        success: '#16a34a', danger: '#dc2626', warning: '#d97706',
        info: '#2563eb', primary: '#2563eb', neutral: '#111827',
      };
      const vColor = valueColors[tone] || '#111827';
      return `${pad}<div class="stat">\n${pad}  <div class="stat-label">${label}</div>\n${pad}  <div class="stat-value" style="color:${vColor}">${value}</div>\n${pad}</div>`;
    }
    case 'MetricsGrid': {
      const metrics = (props.metrics || []) as any[];
      const cols = (props.cols || 3) as number;
      const cards = metrics.map(m =>
        `<div class="metric-card"><div class="metric-value">${esc(String(m.value || ''))}</div><div class="metric-label">${esc(m.label || '')}</div></div>`
      ).join('\n');
      return `${pad}<div class="metrics-grid" style="grid-template-columns:repeat(${cols},1fr)">\n${pad}  ${cards}\n${pad}</div>`;
    }
    case 'Timeline': {
      const items = (props.items || props.events || []) as any[];
      const lis = items.map(item => {
        const time = item.timestamp || item.time || '';
        const title = item.title || '';
        const desc = item.description || '';
        const state = item.state || '';
        const tone = item.tone || '';
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

    // ─── 卡片 ───
    case 'Card': {
      const sub = props.subtitle ? `\n${pad}  <p class="card-subtitle">${esc(String(props.subtitle))}</p>` : '';
      return `${pad}<div class="card">${sub}\n${ch}\n${pad}</div>`;
    }

    // ─── 提示 ───
    case 'Callout': {
      const tone = (props.tone || props.type || 'info') as string;
      // Qoder 自动在标题前加图标
      const icons: Record<string, string> = {
        info: 'ℹ️', warning: '⚠️', danger: '🔴', success: '✅',
        neutral: '•', positive: '✅', caution: '⚠️', critical: '🔴',
      };
      const icon = icons[tone] || 'ℹ️';
      const title = props.title ? `\n${pad}  <div class="callout-title"><span class="callout-icon">${icon}</span> ${esc(String(props.title))}</div>` : '';
      return `${pad}<div class="callout callout-${tone}">${title}\n${pad}  <div class="callout-body">${ch}</div>\n${pad}</div>`;
    }
    case 'Banner': {
      const tone = (props.tone || props.type || 'info') as string;
      const icons: Record<string, string> = {
        info: 'ℹ️', warning: '⚠️', danger: '🔴', success: '✅',
        neutral: '•', positive: '✅', caution: '⚠️', critical: '🔴',
      };
      const icon = icons[tone] || 'ℹ️';
      const title = props.title ? `\n${pad}  <div class="callout-title"><span class="callout-icon">${icon}</span> ${esc(String(props.title))}</div>` : '';
      return `${pad}<div class="callout callout-${tone} banner">${title}\n${pad}  <div class="callout-body">${ch}</div>\n${pad}</div>`;
    }
    case 'Alert':
      return `${pad}<div class="alert">${ch}</div>`;

    // ─── 分隔 ───
    case 'Separator':
    case 'Divider':
      return `<hr class="divider" />`;

    // ─── 步骤 ───
    case 'Steps': {
      const items = (props.items || []) as any[];
      const steps = items.map((item: any, i: number) =>
        `<div class="step"><div class="step-num">${i + 1}</div><div class="step-text">${esc(item.text || '')}</div></div>`
      ).join('\n');
      return `${pad}<div class="steps">\n${pad}  ${steps}\n${pad}</div>`;
    }

    // ─── 证据/方法论 ───
    case 'EvidenceMethodology': {
      const title = props.title ? `\n${pad}  <h3 class="evi-title">${esc(String(props.title))}</h3>` : '';
      const summary = props.summary ? `\n${pad}  <div class="evi-summary">${esc(String(props.summary))}</div>` : '';
      const overview = props.overview ? `\n${pad}  <div class="evi-overview"><strong>验证流程：</strong>${esc(String(props.overview))}</div>` : '';
      
      // metadata 表格
      const meta = (props.metadata || []) as any[];
      let metaHtml = '';
      if (meta.length) {
        metaHtml = `\n${pad}  <table class="table evi-meta"><thead><tr><th class="th">模块</th><th class="th">结果</th></tr></thead><tbody>`;
        for (const item of meta) {
          metaHtml += `\n${pad}    <tr class="tr tr-success"><td class="td">${esc(String(item.label || ''))}</td><td class="td">${esc(String(item.value || ''))}</td></tr>`;
        }
        metaHtml += `\n${pad}  </tbody></table>`;
      }
      
      // groups
      const groups = (props.groups || []) as any[];
      let groupsHtml = '';
      for (const g of groups) {
        groupsHtml += `\n${pad}  <div class="evi-group">`;
        groupsHtml += `\n${pad}    <div class="evi-group-title">${esc(String(g.title || ''))}</div>`;
        for (const item of (g.items || [])) {
          groupsHtml += `\n${pad}    <div class="evi-item"><span class="evi-item-label">${esc(String(item.label || ''))}</span><span class="evi-item-value">${esc(String(item.value || ''))}</span></div>`;
        }
        groupsHtml += `\n${pad}  </div>`;
      }
      
      // accounting
      const accounting = props.accounting ? `\n${pad}  <div class="evi-accounting"><strong>审计说明：</strong>${esc(String(props.accounting))}</div>` : '';
      
      return `${pad}<div class="evidence-methodology">${title}${summary}${overview}${metaHtml}${groupsHtml}${accounting}\n${pad}</div>`;
    }

    // ─── 截图 ───
    case 'img': {
      const src = props.src as string || '';
      const alt = (props.alt || props.title || '截图') as string;
      if (src.startsWith('data:') || src.startsWith('http')) {
        return `${pad}<figure class="canvas-image">\n${pad}  <img src="${esc(src)}" alt="${esc(alt)}" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb" />\n${pad}  <figcaption class="img-caption">${esc(alt)}</figcaption>\n${pad}</figure>`;
      }
      // 尝试解析相对路径
      const resolved = resolveImagePath(src);
      if (resolved) {
        return `${pad}<figure class="canvas-image">\n${pad}  <img src="${esc(resolved)}" alt="${esc(alt)}" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb" />\n${pad}  <figcaption class="img-caption">${esc(alt)}</figcaption>\n${pad}</figure>`;
      }
      // 找不到 → 降级占位
      return `${pad}<figure class="canvas-image-placeholder">\n${pad}  <div class="img-placeholder-box">📷 ${esc(alt)}</div>\n${pad}  <figcaption class="img-caption">${esc(src)} (文件未找到)</figcaption>\n${pad}</figure>`;
    }

    // ─── 未知组件 → 透明容器 ───
    default:
      return `${pad}<div class="unknown-component" data-tag="${esc(tag)}">\n${ch}\n${pad}</div>`;
  }
}

// ─── 主流程 ───

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('用法: node --import tsx scripts/render-test.ts <path-to-canvas.tsx>');
    process.exit(1);
  }

  const src = readFileSync(filePath, 'utf-8');
  const srcBytes = Buffer.byteLength(src, 'utf-8');
  const name = basename(filePath).replace('.canvas.tsx', '');
  CANVAS_DIR = dirname(filePath); // 设置图片解析基目录

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  端到端转换测试: ${basename(filePath)}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // Step 1: 解析
  console.log('【Step 1】解析 .canvas.tsx → IR');
  const startTime = Date.now();
  const result = extractCanvas(src);
  const parseTime = Date.now() - startTime;

  if (!result.root) {
    console.error('❌ 解析失败:', result.errors);
    process.exit(1);
  }

  // 统计 IR
  let components = 0, textNodes = 0, unsupported = 0, unresolved = 0;
  const tagCounts: Record<string, number> = {};

  function walk(node: CanvasNode) {
    if (node.kind === 'element') {
      components++;
      tagCounts[node.tag || 'div'] = (tagCounts[node.tag || 'div'] || 0) + 1;
      if (node.unresolved?.length) unresolved += node.unresolved.length;
      if (node.children) node.children.forEach(walk);
    } else if (node.kind === 'text') {
      textNodes++;
    } else if (node.kind === 'unsupported') {
      unsupported++;
    }
  }
  walk(result.root);

  console.log(`  ✅ 解析成功 (${parseTime}ms)`);
  console.log(`  源文件: ${srcBytes} B`);
  console.log(`  IR: ${components} 组件 + ${textNodes} 文本节点 = ${components + textNodes} 语义单元`);
  if (unsupported > 0) console.log(`  ⚠️  unsupported 节点: ${unsupported}`);
  if (unresolved > 0) console.log(`  ⚠️  unresolved 属性: ${unresolved}`);
  console.log(`  组件分布: ${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(' ')}`);

  // Step 2: 渲染
  console.log('\n【Step 2】IR → HTML');
  const renderStart = Date.now();
  const bodyHtml = irToHtml(result.root);
  const renderTime = Date.now() - renderStart;

  // Step 3: 包装成完整 HTML 页面
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — dsh-canvas-tsx-sidebar 渲染测试</title>
  <style>
    /* ─── 基础 ─── */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5; color: #111827; line-height: 1.6;
    }

    /* ─── 页面容器 ─── */
    .report-shell {
      max-width: 800px; margin: 0 auto;
      padding: 24px 32px; background: #fff;
      border-radius: 12px; border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-top: 24px; margin-bottom: 24px;
    }

    /* ─── 布局 ─── */
    .stack { display: flex; flex-direction: column; }
    .grid { display: grid; }
    .row { display: flex; gap: 16px; }
    .column { flex: 1; min-width: 0; }

    /* ─── 标题 ─── */
    .h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
    .h2 { font-size: 1.25rem; font-weight: 600; color: #111827; margin: 24px 0 6px 0; line-height: 1.3; }
    .h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 16px 0 4px 0; }

    /* ─── 文本 ─── */
    .text { font-size: 0.875rem; color: #374151; }
    .text-secondary { color: #6b7280; }
    .text-muted { color: #9ca3af; }
    .p { font-size: 0.875rem; color: #374151; line-height: 1.6; margin-bottom: 12px; }

    /* ─── 报告章节 ─── */
    .report-section { margin-bottom: 24px; }
    .section-header { margin-bottom: 12px; }
    .section-title { font-size: 1.1rem; font-weight: 600; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
    .section-desc { font-size: 0.875rem; color: #6b7280; margin-top: 4px; }

    /* ─── Stat 指标 ─── */
    .stat { text-align: center; padding: 12px 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .stat-label { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }
    .stat-success .stat-value { color: #16a34a; }
    .stat-danger .stat-value { color: #dc2626; }
    .stat-accent .stat-value { color: #2563eb; }

    /* ─── Table ─── */
    .table-wrap { overflow-x: auto; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .th { padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
    .td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    .tr-success { background: #f0fdf4; }
    .tr-success .td { border-bottom-color: #bbf7d0; }
    .tr-warning { background: #fffbeb; }
    .tr-warning .td { border-bottom-color: #fde68a; }
    .tr-danger { background: #fef2f2; }
    .tr-danger .td { border-bottom-color: #fecaca; }
    .tr-accent { background: #eff6ff; }
    .tr-accent .td { border-bottom-color: #bfdbfe; }
    .tr-muted { background: #f9fafb; }
    .tr-info { background: #eff6ff; }
    .tr-positive { background: #f0fdf4; }
    .tr-caution { background: #fffbeb; }
    .tr-critical { background: #fef2f2; }

    /* ─── Card ─── */
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; background: #fff; }
    .card-subtitle { font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; }

    /* ─── Callout ─── */
    .callout { border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
    .callout-info { border-left: 4px solid #3b82f6; background: #eff6ff; }
    .callout-success { border-left: 4px solid #22c55e; background: #f0fdf4; }
    .callout-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .callout-danger { border-left: 4px solid #ef4444; background: #fef2f2; }
    .callout-neutral { border-left: 4px solid #6b7280; background: #f9fafb; }
    .callout-positive { border-left: 4px solid #22c55e; background: #f0fdf4; }
    .callout-caution { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .callout-critical { border-left: 4px solid #dc2626; background: #fef2f2; }
    .callout-title { font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .callout-icon { font-size: 1rem; line-height: 1; }
    .callout-body { color: #374151; }

    /* ─── Pill ─── */
    .pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; margin-right: 4px; }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-red { background: #fee2e2; color: #991b1b; }
    .pill-yellow { background: #fef9c3; color: #854d0e; }
    .pill-blue { background: #dbeafe; color: #1e40af; }
    .pill-gray { background: #f3f4f6; color: #374151; }
    .pill-info { background: #dbeafe; color: #1e40af; }
    .pill-success { background: #dcfce7; color: #166534; }
    .pill-warning { background: #fef9c3; color: #854d0e; }
    .pill-danger { background: #fee2e2; color: #991b1b; }
    .pill-neutral { background: #f3f4f6; color: #374151; }

    /* ─── Tag ─── */
    .tag { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .tag-success { background: #dcfce7; color: #166534; }
    .tag-danger { background: #fee2e2; color: #991b1b; }
    .tag-warning { background: #fef9c3; color: #854d0e; }
    .tag-info { background: #dbeafe; color: #1e40af; }
    .tag-neutral { background: #f3f4f6; color: #374151; }
    .tag-primary { background: #dbeafe; color: #1e40af; }
    .tag-added { background: #dcfce7; color: #166534; }
    .tag-deleted { background: #fee2e2; color: #991b1b; }
    .tag-active { box-shadow: 0 0 0 1px rgba(59,130,246,0.5); }

    /* ─── Badge ─── */
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #374151; }

    /* ─── Code ─── */
    .code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    .pre { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap; }

    /* ─── Timeline ─── */
    .timeline { border-left: 2px solid #e5e7eb; padding-left: 20px; margin-bottom: 16px; }
    .timeline-item { margin-bottom: 16px; position: relative; }
    .timeline-dot { position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; border: 2px solid #fff; box-shadow: 0 0 0 2px #e5e7eb; }
    .timeline-time { font-size: 0.75rem; color: #6b7280; margin-bottom: 2px; }
    .timeline-title { font-size: 0.9375rem; font-weight: 600; color: #111827; margin-bottom: 4px; }
    .timeline-desc { font-size: 0.8125rem; color: #6b7280; line-height: 1.5; }

    /* ─── Metrics ─── */
    .metrics-grid { display: grid; gap: 16px; margin-bottom: 16px; }
    .metric-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .metric-label { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }

    /* ─── KeyValue ─── */
    .kv-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
    .kv-label { color: #6b7280; }
    .kv-value { color: #111827; font-weight: 500; }

    /* ─── Steps ─── */
    .steps { margin-bottom: 16px; }
    .step { display: flex; gap: 12px; margin-bottom: 8px; }
    .step-num { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .step-text { font-size: 0.875rem; color: #374151; padding-top: 2px; }

    /* ─── 分隔线 ─── */
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

    /* ─── 截图 ─── */
    .canvas-image { margin: 0 0 16px 0; }
    .canvas-image img { display: block; width: 100%; }
    .img-caption { font-size: 0.8125rem; color: #6b7280; margin-top: 6px; text-align: left; }
    .canvas-image-placeholder { margin: 0 0 16px 0; }
    .img-placeholder-box { background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; padding: 32px; text-align: center; color: #6b7280; font-size: 0.875rem; }

    /* ─── EvidenceMethodology ─── */
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

    /* ─── 降级标记 ─── */
    .unsupported { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 2px 6px; font-size: 0.8125rem; color: #92400e; font-family: monospace; }
    .unknown-component { border: 1px dashed #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
    .unknown-component::before { content: "⚠ " attr(data-tag); font-size: 0.75rem; color: #9ca3af; display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  // Step 4: 输出
  const outDir = dirname(filePath);
  const outPath = join(outDir, `${name}.rendered.html`);
  writeFileSync(outPath, fullHtml, 'utf-8');

  const htmlBytes = Buffer.byteLength(fullHtml, 'utf-8');

  console.log(`  ✅ 渲染完成 (${renderTime}ms)`);
  console.log(`  HTML 输出: ${htmlBytes} B (含 CSS 样式表)`);

  console.log('\n【Step 3】对比');
  console.log(`  源文件:  ${srcBytes} B`);
  console.log(`  HTML:    ${htmlBytes} B (含完整 CSS)`);
  console.log(`  比率:    ${(htmlBytes / srcBytes).toFixed(2)}x`);
  console.log(`  纯 body: ${Buffer.byteLength(bodyHtml, 'utf-8')} B`);
  console.log(`  纯 body/源: ${(Buffer.byteLength(bodyHtml, 'utf-8') / srcBytes).toFixed(2)}x`);

  console.log('\n【输出】');
  console.log(`  📄 ${outPath}`);
  console.log(`  → 浏览器打开即可查看渲染效果\n`);
}

main();
