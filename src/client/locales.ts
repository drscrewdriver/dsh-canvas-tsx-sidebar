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
  ja: {
    'tab.title': 'Canvas レポート',
    'tab.desc': '.canvas.tsx レポートを HTML ページとしてレンダリング',
    'input.placeholder': '.canvas.tsx のパス、例: try/report.canvas.tsx',
    'action.open': '開く',
    'mode.label': '表示モード',
    'mode.preview': 'プレビュー',
    'mode.code': 'コード',
    'state.noPath': 'ファイルが指定されていません',
    'state.noPathHint': '上部に .canvas.tsx のパスを入力して Enter を押すと、ここで HTML ページとしてレンダリングされます。',
    'state.loading': '読み込み中…',
    'state.error': '読み込みに失敗しました',
    'state.parseFailed': '解析に失敗しました',
    'error.outsideWorkspace':
      'この絶対パスは現在のセッションのワークスペース外にあるため、読み取りを拒否しました。ワークスペース相対のパスを使用してください。',
    'viewer.title': 'Canvas レポート',
  },
  ko: {
    'tab.title': 'Canvas 보고서',
    'tab.desc': '.canvas.tsx 보고서를 HTML 페이지로 렌더링',
    'input.placeholder': '.canvas.tsx 경로, 예: try/report.canvas.tsx',
    'action.open': '열기',
    'mode.label': '표시 모드',
    'mode.preview': '미리보기',
    'mode.code': '코드',
    'state.noPath': '파일이 지정되지 않았습니다',
    'state.noPathHint': '위쪽에 .canvas.tsx 경로를 입력하고 Enter를 누르면 이곳에서 HTML 페이지로 렌더링됩니다.',
    'state.loading': '읽는 중…',
    'state.error': '읽기 실패',
    'state.parseFailed': '구문 분석 실패',
    'error.outsideWorkspace':
      '해당 절대 경로는 현재 세션 작업 공간 밖에 있어 읽기를 거부했습니다. 작업 공간 상대 경로를 사용하세요.',
    'viewer.title': 'Canvas 보고서',
  },
  fr: {
    'tab.title': 'Rapport Canvas',
    'tab.desc': 'Afficher un rapport .canvas.tsx comme page HTML',
    'input.placeholder': 'Chemin .canvas.tsx, ex. try/report.canvas.tsx',
    'action.open': 'Ouvrir',
    'mode.label': "Mode d'affichage",
    'mode.preview': 'Aperçu',
    'mode.code': 'Code',
    'state.noPath': 'Aucun fichier indiqué',
    'state.noPathHint':
      'Saisissez ci-dessus le chemin d’un fichier .canvas.tsx et appuyez sur Entrée pour l’afficher ici sous forme de page HTML.',
    'state.loading': 'Lecture…',
    'state.error': 'Échec de la lecture',
    'state.parseFailed': 'Échec de l’analyse',
    'error.outsideWorkspace':
      'Ce chemin absolu est hors de l’espace de travail de la session ; la lecture a été refusée. Utilisez un chemin relatif à l’espace de travail.',
    'viewer.title': 'Rapport Canvas',
  },
  de: {
    'tab.title': 'Canvas-Bericht',
    'tab.desc': 'Einen .canvas.tsx-Bericht als HTML-Seite rendern',
    'input.placeholder': '.canvas.tsx-Pfad, z. B. try/report.canvas.tsx',
    'action.open': 'Öffnen',
    'mode.label': 'Anzeigemodus',
    'mode.preview': 'Vorschau',
    'mode.code': 'Code',
    'state.noPath': 'Keine Datei angegeben',
    'state.noPathHint':
      'Gib oben den Pfad zu einer .canvas.tsx-Datei ein und drücke Enter, um sie hier als HTML-Seite zu rendern.',
    'state.loading': 'Wird gelesen…',
    'state.error': 'Lesen fehlgeschlagen',
    'state.parseFailed': 'Analyse fehlgeschlagen',
    'error.outsideWorkspace':
      'Dieser absolute Pfad liegt außerhalb des Sitzungs-Workspaces und wurde abgelehnt. Verwende einen workspace-relativen Pfad.',
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
    'state.noPath': 'Nessun file indicato',
    'state.noPathHint':
      'Inserisci sopra il percorso di un file .canvas.tsx e premi Invio per renderizzarlo qui come pagina HTML.',
    'state.loading': 'Lettura…',
    'state.error': 'Lettura non riuscita',
    'state.parseFailed': 'Analisi non riuscita',
    'error.outsideWorkspace':
      'Questo percorso assoluto è fuori dal workspace della sessione, quindi la lettura è stata rifiutata. Usa un percorso relativo al workspace.',
    'viewer.title': 'Report Canvas',
  },
  ru: {
    'tab.title': 'Отчёт Canvas',
    'tab.desc': 'Отображение отчёта .canvas.tsx как HTML-страницы',
    'input.placeholder': 'Путь к .canvas.tsx, напр. try/report.canvas.tsx',
    'action.open': 'Открыть',
    'mode.label': 'Режим отображения',
    'mode.preview': 'Предпросмотр',
    'mode.code': 'Код',
    'state.noPath': 'Файл не указан',
    'state.noPathHint':
      'Введите выше путь к файлу .canvas.tsx и нажмите Enter, чтобы отобразить его здесь как HTML-страницу.',
    'state.loading': 'Чтение…',
    'state.error': 'Не удалось прочитать',
    'state.parseFailed': 'Не удалось разобрать',
    'error.outsideWorkspace':
      'Этот абсолютный путь находится вне рабочей области текущей сессии, поэтому чтение отклонено. Используйте путь относительно рабочей области.',
    'viewer.title': 'Отчёт Canvas',
  },
  es: {
    'tab.title': 'Informe de Canvas',
    'tab.desc': 'Renderiza un informe .canvas.tsx como página HTML',
    'input.placeholder': 'Ruta de .canvas.tsx, p. ej. try/report.canvas.tsx',
    'action.open': 'Abrir',
    'mode.label': 'Modo de visualización',
    'mode.preview': 'Vista previa',
    'mode.code': 'Código',
    'state.noPath': 'Ningún archivo indicado',
    'state.noPathHint':
      'Escribe arriba la ruta de un .canvas.tsx y pulsa Enter para renderizarlo aquí como página HTML.',
    'state.loading': 'Leyendo…',
    'state.error': 'Error al leer',
    'state.parseFailed': 'Error al analizar',
    'error.outsideWorkspace':
      'Esa ruta absoluta está fuera del espacio de trabajo de la sesión, por lo que se rechazó la lectura. Usa una ruta relativa al espacio de trabajo.',
    'viewer.title': 'Informe de Canvas',
  },
}
