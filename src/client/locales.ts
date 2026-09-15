/**
 * Plugin-owned i18n dictionary.
 *
 * Consumer plugins must NOT reach into better-sidebar's internal `t()` or its
 * `betterSidebar` dictionary namespace (guide §10). We therefore register our
 * own namespace through the DSH `locale` service, exactly as the reference
 * consumer plugin `dsh-code-nav` does (`ctx.locale.register(NS, { zh, en })`).
 */

/** Our own namespace, kept short and package-scoped. */
export const NS = 'dsh-canvas-tsx-sidebar'

/** Locale bundle shape accepted by `ctx.locale.register`. */
export type LocaleBundle = Record<string, Record<string, string>>

export const dictionaries: LocaleBundle = {
  zh: {
    'tab.title': 'Canvas 报告',
    'tab.desc': '渲染工作区 .canvas.tsx 报告',
    'state.loading': '正在读取工作区…',
    'state.empty': '工作区内没有 .canvas.tsx 文件',
    'state.emptyHint': '期望路径形如 <any>/<name>.canvas.tsx',
    'state.error': '读取失败',
    'state.parseFailed': '解析失败',
    'action.reload': '刷新',
    'action.retry': '重试',
  },
  en: {
    'tab.title': 'Canvas Report',
    'tab.desc': 'Render workspace .canvas.tsx reports',
    'state.loading': 'Reading workspace…',
    'state.empty': 'No .canvas.tsx file in this workspace',
    'state.emptyHint': 'Expected a path like <any>/<name>.canvas.tsx',
    'state.error': 'Read failed',
    'state.parseFailed': 'Parse failed',
    'action.reload': 'Refresh',
    'action.retry': 'Retry',
  },
}
