import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const srcPath = process.argv[2];
if (!srcPath) { console.error('Usage: node --import tsx scripts/find-images.ts <canvas-file>'); process.exit(1); }

const src = readFileSync(srcPath, 'utf-8');
const imgRefs = [...src.matchAll(/canvasImage\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);

console.log('canvasImage 引用 (' + imgRefs.length + ' 个):');
imgRefs.forEach(r => console.log('  ' + r));

const canvasDir = dirname(srcPath);
const wsDir = join(canvasDir, '..');

for (const ref of imgRefs) {
  let found = false;

  // 搜索 canvas 同目录
  const c1 = join(canvasDir, ref);
  if (existsSync(c1)) { console.log('✅ 同目录: ' + c1); found = true; continue; }

  // 搜索工作区根目录
  const c2 = join(wsDir, ref);
  if (existsSync(c2)) { console.log('✅ 工作区: ' + c2); found = true; continue; }

  // 递归搜索工作区（限3层）
  function search(d: string, depth: number): string | null {
    if (depth > 3) return null;
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name === ref.split('/').pop()) return join(d, e.name);
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          const r = search(join(d, e.name), depth + 1);
          if (r) return r;
        }
      }
    } catch {}
    return null;
  }

  const foundPath = search(wsDir, 0);
  if (foundPath) {
    console.log('✅ 递归找到: ' + foundPath);
    const st = statSync(foundPath);
    console.log('   大小: ' + (st.size / 1024).toFixed(1) + ' KB, 修改: ' + st.mtime.toISOString());
  } else {
    console.log('❌ 未找到: ' + ref);
  }
}
