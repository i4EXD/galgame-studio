/* 把 assets-src/demo 里的示例素材烘焙成 WebP dataURL，写进 src/demo-assets.ts。
 *
 * 为什么要烘焙：
 *   1. file:// 下浏览器禁止 canvas 读取本地文件（tainted canvas），立绘就没法自动抠图；
 *   2. 素材内联后编辑器才是真正的「单文件」，导出时也不需要再 fetch 外部图片。
 *
 * 用法: node tools/_bake-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.resolve(root, process.argv[2] || 'assets-src/demo');
// 输出成 .json 而不是 .ts：经 esbuild 处理 1.5MB 的 TS 字面量在 Windows 上容易踩到临时文件权限问题，
// 用 ?raw 读 JSON 文本则完全绕开编译环节。
const outFile = path.resolve(root, process.argv[3] || 'src/demo-assets.json');
const sourceUrl = '/' + path.relative(root, sourceDir).split(path.sep).map(encodeURIComponent).join('/');

if (!fs.existsSync(sourceDir)) {
  console.error(`没有找到 ${sourceDir}（示例素材源目录）`);
  process.exit(1);
}

const files = fs.readdirSync(sourceDir).filter(name => /\.(png|jpe?g|webp)$/i.test(name)).sort();
if (!files.length) { console.error('示例素材目录是空的'); process.exit(1); }

const PORT = 4411;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('找不到 Chrome / Edge'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const bakeHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>bake</title></head>
<body>
<pre id="log">baking…</pre>
<script>
const FILES = ${JSON.stringify(files)};
const QUALITY = 0.92;
const MAX = { sprite: 1400, other: 1920 };
function isSprite(name) { return /^nozomi-|sprite|立绘/i.test(name) && !/cg|promise/i.test(name); }
function load(src) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('load failed: ' + src)); };
    img.src = src;
  });
}
(async function () {
  const out = {};
  const log = document.getElementById('log');
  function report(text) {
    log.textContent = text;
    try { fetch('http://127.0.0.1:${PORT}/log?text=' + encodeURIComponent(text), { method: 'POST' }); } catch (e) { /* 忽略 */ }
  }
  report('开始烘焙 ' + FILES.length + ' 个文件');
  for (const file of FILES) {
    const img = await load(${JSON.stringify(sourceUrl)} + '/' + encodeURIComponent(file));
    const max = isSprite(file) ? MAX.sprite : MAX.other;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL('image/webp', QUALITY);
    out[file] = { src: src, width: canvas.width, height: canvas.height, bytes: Math.round((src.length - src.indexOf(',') - 1) * 0.75) };
    report('baked ' + file + ' (' + Math.round(out[file].bytes / 1024) + 'KB)');
  }
  const response = await fetch('http://127.0.0.1:${PORT}/save', { method: 'POST', body: JSON.stringify(out) });
  report('done: ' + response.status);
  window.__baked = true;
})().catch(function (error) { document.getElementById('log').textContent = 'ERROR ' + error.message; try { fetch('http://127.0.0.1:${PORT}/log?text=' + encodeURIComponent('ERROR ' + error.message), { method: 'POST' }); } catch (e) {} });
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'POST' && req.url.startsWith('/log')) {
    const text = new URL(req.url, 'http://x').searchParams.get('text') || '';
    console.log('  [bake]', text);
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      try {
        const data = JSON.parse(body);
        const entries = Object.keys(data).sort();
        const total = entries.reduce((sum, name) => sum + data[name].bytes, 0);
        fs.writeFileSync(outFile, JSON.stringify(data));
        console.log(`已写入 ${path.relative(root, outFile)}（${entries.length} 个素材，${(total / 1024 / 1024).toFixed(2)} MB）`);
      } catch (error) {
        console.error('解析烘焙结果失败', error);
      }
      res.writeHead(200).end('ok');
      cleanup(0);
    });
    return;
  }
  // 静态服务项目根：让 bake 页面能读到 assets-src/demo/*
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'text/plain; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
});

const bakeFile = path.join(root, 'tools', '_bake.html');
fs.writeFileSync(bakeFile, bakeHtml);

let child = null;
let done = false;
function cleanup(code, keepBakeFile) {
  if (done) return;
  done = true;
  if (child) child.kill();
  if (!keepBakeFile) { try { fs.unlinkSync(bakeFile); } catch { /* 忽略 */ } }
  server.close();
  setTimeout(() => process.exit(code), 120);
}

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/tools/_bake.html`;
  console.log(`烘焙中… ${url}`);
  // 注意：headless Chrome 在没有「输出任务」时会加载完就退出，
  // 所以这里挂一个临时截图任务，让浏览器留到页面把结果 POST 回来。
  const keepAliveShot = path.join(root, '_export', `_bake-${Date.now()}.png`);
  fs.mkdirSync(path.dirname(keepAliveShot), { recursive: true });
  child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', `gs-bake-${Date.now()}`),
    '--window-size=800,200',
    `--screenshot=${keepAliveShot}`,
    '--virtual-time-budget=90000',
    url,
  ], { stdio: 'ignore' });
  child.on('error', (error) => { console.error('Chrome 启动失败:', error.message); cleanup(1); });
  child.on('exit', (code) => {
    if (!done) {
      console.error(`Chrome 已退出（code=${code}），但没有收到烘焙结果`);
      cleanup(1, true);
    }
  });
});

setTimeout(() => { console.error('烘焙超时（保留 tools/_bake.html 便于手动排查）'); cleanup(1, true); }, 90000);
