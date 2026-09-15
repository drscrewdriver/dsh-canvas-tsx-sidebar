/**
 * render-with-images.ts — standalone `.rendered.html` export.
 *
 * A thin CLI over the ONE renderer in `src/client/canvas/render.tsx`. It exists
 * to produce an inspectable file for visual QA against Qoder's native canvas;
 * it owns no rendering logic of its own, so the exported page and the sidebar
 * tab cannot drift.
 *
 * The only thing this file adds is the image seam: it resolves `canvasImage()`
 * references off disk and inlines them as data URIs, which is what makes the
 * export self-contained. The sidebar resolves the same references through
 * better-sidebar's `mediaUrl` instead.
 *
 * Usage: node --import tsx scripts/render-with-images.ts <canvas-file>
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { extractCanvas } from '../src/client/canvas/extract'
import { CanvasDocument } from '../src/client/canvas/render'
import { countNodes } from '../src/client/canvas/ir'
import { CANVAS_CSS, CANVAS_PAGE_CSS } from '../src/client/canvas/styles'

/** Extension -> MIME, for the data URI. */
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/** Inline one reference as a data URI, or `undefined` when it is not on disk. */
function embedReference(ref: string, canvasDir: string): string | undefined {
  if (ref.startsWith('data:') || ref.startsWith('http://') || ref.startsWith('https://')) return ref

  // `./x.png` is relative to the canvas file; a bare name may sit one level up.
  for (const candidate of [join(canvasDir, ref), join(canvasDir, '..', ref)]) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue
    try {
      const bytes = readFileSync(candidate)
      const mime = MIME[extname(candidate).toLowerCase()] ?? 'image/png'
      console.log(`  ✅ ${ref} -> ${basename(candidate)} (${(bytes.length / 1024).toFixed(0)} KB)`)
      return `data:${mime};base64,${bytes.toString('base64')}`
    } catch {
      // Unreadable file: fall through to the placeholder.
    }
  }
  console.log(`  ⚠️  ${ref} -> not found`)
  return undefined
}

function main(): void {
  const filePath = process.argv[2]
  if (filePath === undefined) {
    console.error('Usage: node --import tsx scripts/render-with-images.ts <canvas-file>')
    process.exit(1)
  }

  const source = readFileSync(filePath, 'utf-8')
  const canvasDir = dirname(filePath)
  const name = basename(filePath).replace(/\.canvas\.tsx$/, '')

  console.log(`\n═══ render: ${basename(filePath)} ═══\n`)

  const result = extractCanvas(source)
  if (!result.ok) {
    console.error(`❌ parse failed: ${result.error.code} — ${result.error.message}`)
    process.exit(1)
  }

  const { components, texts } = countNodes(result.root)
  console.log(`IR: ${components} components + ${texts} text nodes`)

  const markup = renderToStaticMarkup(
    createElement(CanvasDocument, {
      root: result.root,
      options: { resolveImage: ref => embedReference(ref, canvasDir) },
    }),
  )

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
<style>
${CANVAS_PAGE_CSS}
${CANVAS_CSS}
</style>
</head>
<body>
${markup}
</body>
</html>
`

  const outPath = join(canvasDir, `${name}.rendered.html`)
  writeFileSync(outPath, html, 'utf-8')

  console.log(`\nHTML: ${Buffer.byteLength(html, 'utf-8')} B`)
  console.log(`📄 ${outPath}`)
}

main()
