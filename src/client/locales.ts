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
  fr: {
    'tab.title': 'Rapport Canvas',
    'tab.desc': 'Affiche un rapport .canvas.tsx comme page HTML',
    'input.placeholder': 'Chemin .canvas.tsx, ex. try/report.canvas.tsx',
    'action.open': 'Ouvrir',
    'mode.label': 'Mode d’affichage',
    'mode.preview': 'Aperçu',
    'mode.code': 'Code',
    'state.noPath': 'Aucun fichier indiqué',
    'state.noPathHint':
      'Saisissez ci-dessus le chemin d’un .canvas.tsx et appuyez sur Entrée pour l’afficher ici en page HTML.',
    'state.loading': 'Lecture…',
    'state.error': 'Échec de lecture',
    'state.parseFailed': 'Échec de l’analyse',
    'error.outsideWorkspace':
      'Ce chemin absolu est hors de l’espace de travail de la session, il a donc été refusé. Utilisez un chemin relatif à l’espace de travail.',
    'viewer.title': 'Rapport Canvas',
  },
  de: {
    'tab.title': 'Canvas-Bericht',
    'tab.desc': 'Rendert einen .canvas.tsx-Bericht als HTML-Seite',
    'input.placeholder': '.canvas.tsx-Pfad, z. B. try/report.canvas.tsx',
    'action.open': 'Öffnen',
    'mode.label': 'Anzeigemodus',
    'mode.preview': 'Vorschau',
    'mode.code': 'Code',
    'state.noPath': 'Keine Datei angegeben',
    'state.noPathHint':
      'Geben Sie oben den Pfad zu einer .canvas.tsx ein und drücken Sie Enter, um sie hier als HTML-Seite zu rendern.',
    'state.loading': 'Wird gelesen…',
    'state.error': 'Lesen fehlgeschlagen',
    'state.parseFailed': 'Parsen fehlgeschlagen',
    'error.outsideWorkspace':
      'Dieser absolute Pfad liegt außerhalb des Sitzungs-Arbeitsbereichs und wurde abgelehnt. Verwenden Sie einen arbeitsbereichsrelativen Pfad.',
    'viewer.title': 'Canvas-Bericht',
  },
  it: {
    'tab.title': 'Report Canvas',
    'tab.desc': 'Renderizza un report .canvas.tsx come pagina HTML',
    'input.placeholder': 'Percorso .canvas.tsx, es. try/report.canvas.tsx',
    'action.open': 'Apri',
    'mode.label': 'Modalità di visualizzazione',
    'mode.preview': 'Anteprima',
    'mode.code': 'Codice',
    'state.noPath': 'Nessun file specificato',
    'state.noPathHint':
      'Digita sopra il percorso di un .canvas.tsx e premi Invio per visualizzarlo qui come pagina HTML.',
    'state.loading': 'Lettura…',
    'state.error': 'Lettura non riuscita',
    'state.parseFailed': 'Analisi non riuscita',
    'error.outsideWorkspace':
      'Il percorso assoluto è fuori dallo spazio di lavoro della sessione ed è stato rifiutato. Usa un percorso relativo allo spazio di lavoro.',
    'viewer.title': 'Report Canvas',
  },
  ru: {
    'tab.title': 'Отчёт Canvas',
    'tab.desc': 'Отображает отчёт .canvas.tsx как HTML-страницу',
    'input.placeholder': 'Путь к .canvas.tsx, напр. try/report.canvas.tsx',
    'action.open': 'Открыть',
    'mode.label': 'Режим отображения',
    'mode.preview': 'Предпросмотр',
    'mode.code': 'Код',
    'state.noPath': 'Файл не указан',
    'state.noPathHint':
      'Введите выше путь к .canvas.tsx и нажмите Enter, чтобы отрисовать его здесь как HTML-страницу.',
    'state.loading': 'Чтение…',
    'state.error': 'Ошибка чтения',
    'state.parseFailed': 'Ошибка разбора',
    'error.outsideWorkspace':
      'Абсолютный путь находится вне рабочей области сессии, в чтении отказано. Используйте путь относительно рабочей области.',
    'viewer.title': 'Отчёт Canvas',
  },
  es: {
    'tab.title': 'Informe Canvas',
    'tab.desc': 'Renderiza un informe .canvas.tsx como página HTML',
    'input.placeholder': 'Ruta de .canvas.tsx, p. ej. try/report.canvas.tsx',
    'action.open': 'Abrir',
    'mode.label': 'Modo de vista',
    'mode.preview': 'Vista previa',
    'mode.code': 'Código',
    'state.noPath': 'Sin archivo indicado',
    'state.noPathHint':
      'Escribe arriba la ruta de un .canvas.tsx y pulsa Intro para mostrarlo aquí como página HTML.',
    'state.loading': 'Leyendo…',
    'state.error': 'Error al leer',
    'state.parseFailed': 'Error al analizar',
    'error.outsideWorkspace':
      'Esa ruta absoluta está fuera del espacio de trabajo de la sesión, por lo que se rechazó. Usa una ruta relativa al espacio de trabajo.',
    'viewer.title': 'Informe Canvas',
  },
}
