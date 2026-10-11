// 调试脚本：扫描指定 .canvas.tsx 文件里的 canvasImage('...') 图片引用，
// 逐个检查相对路径能否在 canvas 目录旁解析到真实文件，并打印大小与 base64 长度。
// 一次性排查用入口（srcPath 硬编码），不参与构建。
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';

const srcPath = 'C:/Users/joshua/.qoder/projects/e--test-rewrite-agently/canvases/inferglow-web-completion.canvas.tsx';
const src = readFileSync(srcPath, 'utf-8');
const canvasDir = dirname(srcPath);

// 匹配 `canvasImage('路径')` 调用（允许 const xx = 前缀），捕获组为图片相对路径
const re = /(?:const\s+\w+\s*=\s*)?canvasImage\(['"]([^'"]+)['"]\)/g;
let m: RegExpExecArray | null;
let count = 0;
while ((m = re.exec(src)) !== null) {
  count++;
  const ref = m[1];
  console.log('匹配: ' + ref);

  const candidates = [join(canvasDir, ref), join(canvasDir, '..', ref)];
  for (const c of candidates) {
    if (existsSync(c)) {
      const st = statSync(c);
      console.log('  找到: ' + c + ' (' + (st.size / 1024).toFixed(0) + ' KB)');
      const buf = readFileSync(c);
      const ext = extname(c).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.jpg' ? 'image/jpeg' : 'image/png';
      const b64 = buf.toString('base64');
      console.log('  base64 长度: ' + b64.length);
      break;
    }
  }
}
console.log('总匹配: ' + count);
