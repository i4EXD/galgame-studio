/* 截图验证工具：把 dist/index.html 复制成 _test.html 并注入一段「自动操作」脚本，
   然后用 headless Chrome 截图。用法:
     node _shot.mjs <outPng> [query] [width] [height] [waitMs]
   支持的 query 参数:
     close=1            关掉新手引导弹窗
     view=script|chapters|cast|assets|theme|publish   切换视图
     guide=1            重新打开引导
     theme=sakura       切换主题（点击主题预设）
     template=1         打开模板弹窗
     play=0.5           等一段时间后截图（秒）
*/
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const prod = process.argv.includes('--prod');
const source = prod ? path.join(root, 'dist', 'index.html') : path.join(root, 'index.html');
if (!fs.existsSync(source)) { console.error(`${source} 不存在`); process.exit(1); }

const args = process.argv.slice(2).filter(a => a !== '--prod');
const outPng = args[0] || '_shot/shot.png';
const query = args[1] || '';
const width = Number(args[2] || 1680);
const height = Number(args[3] || 1000);
const waitMs = Number(args[4] || 14000);

const TEST_SCRIPT = `
<script>
(function () {
  var params = new URLSearchParams(location.search);
  var viewIndex = { script: 0, chapters: 1, cast: 2, assets: 3, theme: 4, publish: 5 };
  function waitFor(selector, fn, tries) {
    tries = tries == null ? 400 : tries;
    var nodes = document.querySelectorAll(selector);
    if (nodes.length) { fn(nodes); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitFor(selector, fn, tries - 1); }, 80);
  }
  function click(selector, index) {
    waitFor(selector, function (nodes) {
      var node = nodes[index || 0];
      if (node) node.click();
    });
  }
  if (params.get('close')) {
    // 先关掉新手引导，再看后面的视图
    click('.gs-modal-backdrop .gs-icon-btn');
    setTimeout(function () { click('.gs-modal-backdrop .gs-icon-btn'); }, 400);
  }
  var view = params.get('view');
  if (view != null) setTimeout(function () { click('.gs-view', viewIndex[view] || 0); }, 500);
  var lineIndex = params.get('line');
  if (lineIndex != null) setTimeout(function () { click('.gs-line', Number(lineIndex)); }, 900);
  var preset = params.get('theme');
  if (preset != null) setTimeout(function () { click('.gs-swatch', Number(preset)); }, 900);
  if (params.get('guide')) setTimeout(function () { click('.gs-topactions .gs-btn', 2); }, 900);
  if (params.get('template')) setTimeout(function () { click('.gs-topactions .gs-btn', 3); }, 900);
  var scroll = params.get('scroll');
  if (scroll) setTimeout(function () {
    var col = document.querySelector(scroll);
    if (col) col.scrollTop = Number(params.get('top') || 600);
  }, 2500);
})();
</script>
`;

// 注意：打包后的内联脚本里也含有 "</body>" 字样（导出模板），必须替换最后一个
const html = (() => {
  const raw = fs.readFileSync(source, 'utf8');
  const at = raw.lastIndexOf('</body>');
  return at < 0 ? raw : raw.slice(0, at) + TEST_SCRIPT + raw.slice(at);
})();
const testFile = prod ? path.join(root, 'dist', '_test.html') : path.join(root, '_test.html');
fs.writeFileSync(testFile, html);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

const port = prod ? (process.env.GS_PORT || 4401) : '5199';
const url = `http://127.0.0.1:${port}/${prod ? '_test.html' : '_test.html'}${query ? `?${query}` : ''}`;
const shot = path.resolve(outPng);
fs.mkdirSync(path.dirname(shot), { recursive: true });

const result = spawnSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${path.join(process.env.TEMP || '/tmp', `gs-shot-${Date.now()}`)}`,
  `--window-size=${width},${height}`,
  `--screenshot=${shot}`,
  `--virtual-time-budget=${waitMs}`,
  url,
], { encoding: 'utf8' });

const stdout = `${result.stdout || ''}${result.stderr || ''}`;
const written = /(\d+) bytes written/.exec(stdout);
console.log(`${url} -> ${written ? `${written[1]} bytes` : 'FAILED'}  ${shot}`);
