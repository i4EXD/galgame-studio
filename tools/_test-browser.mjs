import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => {
    const value = n / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert.ok(chrome, 'Chrome or Edge is required');
mkdirSync(path.resolve('.tmp'), { recursive: true });
const profile = mkdtempSync(path.resolve('.tmp/browser-test-'));
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank']);
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser startup timeout')), 15000);
    let output = '';
    browser.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once('error', reject);
  });
  const pages = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timeout`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'mobile' });
    await call('Page.navigate', { url: pathToFileURL(path.resolve('dist/index.html')).href });
    await evaluate(`new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = setInterval(() => {
        if (window.__galStore?.state.ready) { clearInterval(timer); resolve(true); }
        else if (++attempts > 100) { clearInterval(timer); reject(new Error('Editor startup timeout')); }
      }, 100);
    })`);
    await evaluate('window.__galStore.toggleGuide(false)');
    await evaluate('new Promise(resolve => setTimeout(resolve, 500))');
    assert.equal(await evaluate("Boolean(document.querySelector('.gs-app, .gm-app'))"), true);
    assert.equal(await evaluate("Boolean(document.querySelector('#gs-fatal'))"), false);
    const shot = await call('Page.captureScreenshot');
    writeFileSync(path.resolve(`.tmp/verified-${name}.png`), Buffer.from(shot.data, 'base64'));
    await evaluate(`window.__galStore.state.project.characters.slice().forEach(c => window.__galStore.deleteCharacter(c.id));
      window.__galStore.select('line', ''); window.__galStore.setView('cast');`);
    await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
    assert.equal(await evaluate("Boolean(document.querySelector('#gs-fatal'))"), false);
    assert.equal(await evaluate('window.__galStore.state.project.characters.length'), 0);
    console.log(`PASS ${name}: startup, preview screenshot, empty cast navigation`);
    for (const title of ['海风来信', '雨夜霓虹', '冬日书店']) {
      if (name === 'desktop') {
        await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '模板').click()");
      } else {
        await evaluate("document.querySelector('[aria-label=更多]').click()");
        await evaluate('new Promise(resolve => setTimeout(resolve, 100))');
        await evaluate("Array.from(document.querySelectorAll('.gm-menuitem')).find(b => b.textContent.includes('换一个模板')).click()");
      }
      await evaluate('new Promise(resolve => setTimeout(resolve, 100))');
      assert.equal(await evaluate("Array.from(document.querySelectorAll('.gs-template-cover, .gm-template-cover')).every(img => img.complete && img.naturalWidth > 0)"), true);
      await evaluate(`Array.from(document.querySelectorAll('.gs-template, .gm-menuitem')).find(b => b.textContent.includes(${JSON.stringify(title)})).click()`);
      await evaluate('new Promise(resolve => setTimeout(resolve, 300))');
      assert.equal(await evaluate('window.__galStore.state.project.title'), title);
      assert.equal(await evaluate('window.__galStore.state.project.lines.length'), 6);
      assert.equal(await evaluate("window.__galStore.state.project.assets[0].src.startsWith('data:image/webp')"), true);
      if (name === 'mobile') await evaluate("document.querySelector('[aria-label=预览]').click()");
      await evaluate('new Promise(resolve => setTimeout(resolve, 500))');
      const preset = await evaluate('window.__galStore.state.project.theme.preset');
      assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelector('.game').dataset.theme"), preset);
      if (preset === 'coast' || preset === 'winter') {
        assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelector('.game').dataset.veil"), preset === 'coast' ? 'soft' : '0', `${name}: live theme must apply its scene veil`);
        const colors = await evaluate(`(() => {
          const frame = document.querySelector('iframe').contentWindow;
          const tag = frame.getComputedStyle(frame.document.querySelector('.speaker-tag'));
          return { text: tag.color, background: tag.backgroundColor, gradient: tag.backgroundImage };
        })()`);
        const light = Math.max(luminance(colors.text), luminance(colors.background));
        const dark = Math.min(luminance(colors.text), luminance(colors.background));
        assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `${preset}: speaker label contrast`);
        assert.equal(colors.gradient, 'none');
        assert.equal(await evaluate(`(() => {
          const element = document.querySelector('iframe').contentDocument.querySelector('.chapter-title');
          return element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
        })()`), true, `${preset}: chapter title spans must have room for text`);
        for (const panel of ['menu', 'chapters', 'save', 'settings']) {
          await evaluate(`document.querySelector('iframe').contentWindow.__galPlayer.openPanel(${JSON.stringify(panel)})`);
          await evaluate('new Promise(resolve => setTimeout(resolve, 100))');
          if (panel === 'chapters') {
            const background = await evaluate("document.querySelector('iframe').contentWindow.getComputedStyle(document.querySelector('iframe').contentDocument.querySelector('.chapter-card')).backgroundImage");
            assert.ok(!background.includes('11, 25, 25'), `${preset}: chapter cards must use the theme palette`);
          }
          if (panel === 'menu') {
            assert.equal(await evaluate(`(() => {
              const frame = document.querySelector('iframe').contentWindow;
              const button = frame.document.querySelector('.menu-primary');
              return frame.getComputedStyle(button).color === frame.getComputedStyle(button.querySelector('svg')).color;
            })()`), true, `${preset}: primary button icons follow its text color`);
          }
          const panelShot = await call('Page.captureScreenshot');
          writeFileSync(path.resolve(`.tmp/theme-${name}-${preset}-${panel}.png`), Buffer.from(panelShot.data, 'base64'));
          await evaluate("document.querySelector('iframe').contentWindow.__galPlayer.closePanel()");
        }
      }
      const capture = await call('Page.captureScreenshot');
      writeFileSync(path.resolve(`.tmp/template-${name}-${preset}.png`), Buffer.from(capture.data, 'base64'));
      if (name === 'mobile') await evaluate("document.querySelector('[aria-label=关闭预览]').click()");
      assert.equal(await evaluate("Boolean(document.querySelector('#gs-fatal'))"), false);
      console.log(`PASS ${name}: ${title}, embedded artwork and player theme`);
    }
  }
} finally {
  socket?.close();
  browser.kill();
}
