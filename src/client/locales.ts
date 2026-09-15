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
    'tab.desc': '把 .canvas.tsx 报告渲染成 HTML 页面',
    'input.placeholder': '.canvas.tsx 路径，例如 try/report.canvas.tsx',
    'action.open': '打开',
    'mode.label': '显示方式',
    'mode.preview': '预览',
    'mode.code': '代码',
    'state.noPath': '尚未指定文件',
    'state.noPathHint': '在上方输入 .canvas.tsx 的路径后回车，即可在此渲染为 HTML 页面。',
    'state.loading': '正在读取…',
    'state.error': '读取失败',
    'state.parseFailed': '解析失败',
    'error.outsideWorkspace': '该绝对路径不在当前会话工作区内，已拒绝读取。请改用相对工作区的路径。',
    'viewer.title': 'Canvas 报告',
  },
  en: {
    'tab.title': 'Canvas Report',
    'tab.desc': 'Render a .canvas.tsx report as an HTML page',
    'input.placeholder': '.canvas.tsx path, e.g. try/report.canvas.tsx',
    'action.open': 'Open',
    'mode.label': 'Display mode',
    'mode.preview': 'Preview',
    'mode.code': 'Code',
    'state.noPath': 'No file given',
    'state.noPathHint': 'Type the path to a .canvas.tsx above and press Enter to render it here as an HTML page.',
    'state.loading': 'Reading…',
    'state.error': 'Read failed',
    'state.parseFailed': 'Parse failed',
    'error.outsideWorkspace':
      'That absolute path is outside the session workspace, so it was refused. Use a workspace-relative path.',
    'viewer.title': 'Canvas Report',
  },
}
