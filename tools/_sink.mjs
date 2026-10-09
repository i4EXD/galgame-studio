/* 导出产物收集器：接收浏览器 POST 过来的 HTML，写到 _export/ 目录。
   用于端到端验证「编辑器导出的单文件 HTML」在 file:// 下能否独立运行。
   用法: node _sink.mjs [port] */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] || 4402);
const outDir = path.resolve(import.meta.dirname, '..', '_export');
fs.mkdirSync(outDir, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405).end('use POST'); return; }
  const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'export.html').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const file = path.join(outDir, name);
    fs.writeFileSync(file, body);
    console.log(`saved ${file} (${body.length} bytes)`);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`saved ${body.length}`);
  });
}).listen(port, '127.0.0.1', () => console.log(`sink listening on http://127.0.0.1:${port}/`));
