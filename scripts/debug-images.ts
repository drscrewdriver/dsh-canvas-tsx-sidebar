import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';

const srcPath = 'C:/Users/joshua/.qoder/projects/e--test-rewrite-agently/canvases/inferglow-web-completion.canvas.tsx';
const src = readFileSync(srcPath, 'utf-8');
const canvasDir = dirname(srcPath);

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
