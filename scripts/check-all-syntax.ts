import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const dirs = [
  'C:/Users/joshua/.qoder/projects/e--test-rewrite-agently/canvases',
  'C:/Users/joshua/.qoder/projects/e--test-devops-manager-workspace/canvases',
  'C:/Users/joshua/AppData/Roaming/QoderCN/SharedClientCache/cache/workingSpace',
  'E:/test/machine-learning/.qoder/canvas',
];

const seen = new Set<string>();
const results: { file: string; errors: number; details: string }[] = [];

for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.canvas.tsx'));
  for (const f of files) {
    const full = join(dir, f);
    if (seen.has(full)) continue;
    seen.add(full);
    try {
      const out = execSync(`node scripts/syntax-oracle.cjs "${full}"`, { encoding: 'utf-8', timeout: 10000, cwd: 'E:/test/rewrite-agently/mine-dsh-plugins/dsh-canvas-tsx-sidebar' });
      const match = out.match(/TS parse diagnostics: (\d+)/);
      const errors = match ? parseInt(match[1]) : -1;
      if (errors > 0) {
        const detail = out.split('\n').filter(l => l.includes('TS') || l.includes('error')).join('; ');
        results.push({ file: f.substring(0, 60), errors, details: detail.substring(0, 120) });
      }
    } catch (e: any) {
      results.push({ file: f.substring(0, 60), errors: -1, details: (e.message || '').substring(0, 120) });
    }
  }
}

console.log(`语法检查: ${seen.size} 个文件\n`);
if (results.length === 0) {
  console.log('✅ 全部通过');
} else {
  console.log(`❌ ${results.length} 个文件有错误:\n`);
  for (const r of results) {
    console.log(`${r.file}  诊断=${r.errors}`);
    if (r.details) console.log(`  ${r.details}`);
  }
}
