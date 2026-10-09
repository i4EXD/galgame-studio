/* 验证「导出文件」的分块传输协议：
   网页端按 CHUNK 切 base64 → 原生端逐块 Base64.decode(NO_WRAP) 后顺序写入。
   只要每块长度是 4 的倍数，逐块解码就能无损重组（Android 侧正是这么做的）。
   用法: node tools/_test-bridge.mjs */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const CHUNK = 192 * 1024;   // 必须与 src/mobile/bridge.ts 一致

const source = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(source)) { console.error('先构建 dist/index.html'); process.exit(1); }

const text = fs.readFileSync(source, 'utf8');
const bytes = new TextEncoder().encode(text);
const base64 = Buffer.from(bytes).toString('base64');

const chunks = [];
for (let i = 0; i < base64.length; i += CHUNK) chunks.push(base64.slice(i, i + CHUNK));

// Android 的 Base64.NO_WRAP 等价于 Node 的 'base64' 解码
const decoded = Buffer.concat(chunks.map(chunk => Buffer.from(chunk, 'base64')));

const badChunks = chunks.filter(chunk => chunk.length % 4 !== 0).length;
const report = [
  ['源文件', `${path.relative(root, source)}（${(bytes.length / 1024 / 1024).toFixed(2)} MB）`],
  ['编码后 base64', `${(base64.length / 1024 / 1024).toFixed(2)} MB`],
  ['分块数', `${chunks.length} 块（每块 ${CHUNK / 1024} KB）`],
  ['每块都是 4 的倍数', badChunks === 0 ? '是' : `否（${badChunks} 块不合法）`],
  ['重组结果与原文件一致', decoded.equals(Buffer.from(bytes)) ? '是' : '否'],
  ['重组后大小', `${(decoded.length / 1024 / 1024).toFixed(2)} MB`],
];

console.log('分块传输协议验证');
for (const [label, value] of report) console.log(`  ${label}: ${value}`);

const ok = badChunks === 0 && decoded.equals(Buffer.from(bytes));
console.log(ok ? '\n结论: 协议正确，导出的文件不会损坏' : '\n结论: 协议有问题，导出文件会损坏');
process.exit(ok ? 0 : 1);
