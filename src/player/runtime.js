/* ============================================================================
 * Galgame Studio · 播放器运行时
 * ----------------------------------------------------------------------------
 * 从原 galgame 引擎（React 版 App.tsx / CharacterSprite.tsx）泛化而来的独立运行时：
 *   · 逐字打字机 / 自动播放 / 快进 / 隐藏界面 / 全屏
 *   · 章节、章节回廊、进度解锁
 *   · 立绘（自动去背景 + 多表情 + 呼吸 + 说话高亮）/ 背景交叉淡入 / 事件 CG
 *   · 存档 / 读档 / 历史回看（可跳回任意一句）/ 设置 / 结局
 *   · Web Audio 合成环境音（无需素材即可有氛围），也可换成上传的音频
 *
 * 本文件是「纯脚本」：不依赖任何库、不含 import/export，
 * 既能被编辑器直接 <script> 引入，也能原样内联进导出的单文件 HTML。
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ 图标 */
  var ICONS = {
    menu: '<path d="M4 7h16M9 12h11M4 17h16"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    history: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    skip: '<path d="m3 6 8 6-8 6Zm10 0 8 6-8 6Z"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h9V3M7 21v-8h10v8"/>',
    load: '<path d="M3 7V4h7l3 3h8v13H3V7Z"/><path d="M12 10v7m-3-3 3 3 3-3"/>',
    settings: '<path d="m9 3-.8 2.5-2.5.6-2 3.4 1.7 2-.2 2.5 1.7 3.3 2.6.3L11 20h3l1.2-2.4 2.6-.4 1.8-3.2-1.2-2.3 1.2-2.3-1.9-3.2-2.6-.4L14 3Z"/><circle cx="12" cy="11.5" r="3"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="m11 4-6 5H2v6h3l6 5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    star: '<path d="m12 2 2.8 6.5L22 12l-7.2 3.5L12 22l-2.8-6.5L2 12l7.2-3.5Z"/>'
  };
  function icon(name, size) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 让作者可以在文案里写 <br> 换行，其余 HTML 一律转义（安全） */
  function richText(value) {
    return esc(value).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  }
  function node(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function noop() {}

  /* -------------------------------------------------------------- 去背景 */
  // 纯色背景立绘抠图：从四边向内做连通域填充，再按颜色距离做边缘羽化与去溢色。
  // 比「按颜色一刀切」更安全：角色身上与背景同色但不相连的区域不会被误伤。
  var keyCache = new Map();
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#ff00ff').trim());
    if (!m) return [255, 0, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function keyOut(src, keyColor, tolerance, edgeOnly) {
    var cacheKey = src + '|' + keyColor + '|' + tolerance + '|' + (edgeOnly ? 'edge' : 'all');
    if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);
    var job = new Promise(function (resolve, reject) {
      var image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          var ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('canvas unavailable');
          ctx.drawImage(image, 0, 0);
          var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          chromaKey(imageData, hexToRgb(keyColor), tolerance == null ? 110 : tolerance, !!edgeOnly);
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (error) { reject(error); }
      };
      image.onerror = function () { reject(new Error('sprite load failed')); };
      image.src = src;
    });
    keyCache.set(cacheKey, job);
    job.catch(function () { keyCache.delete(cacheKey); });
    return job;
  }
  /**
   * 纯色背景抠图。
   * 思路：把「背景色相对灰色的偏移方向」当成一个轴，量每个像素在这个轴上的投影
   * （keyness）。灰、白、黑的投影为 0 因此一定保留，与背景同色系的像素才会透明。
   *   edgeOnly = true 时只处理与画面边缘连通的区域（保护角色身上与背景同色的部分）。
   */
  function chromaKey(imageData, key, tolerance, edgeOnly) {
    var w = imageData.width, h = imageData.height, data = imageData.data;
    var kr = key[0], kg = key[1], kb = key[2];
    var keyGray = (kr + kg + kb) / 3;
    var kdr = kr - keyGray, kdg = kg - keyGray, kdb = kb - keyGray;
    var klen2 = kdr * kdr + kdg * kdg + kdb * kdb;
    if (klen2 < 400) { kdr = 1; kdg = -1; kdb = 1; klen2 = 3; }   // 背景色本身是灰阶时的兜底
    var t1 = Math.max(0.10, Math.min(0.95, tolerance / 255));
    var t0 = t1 * 0.34;

    var mask = null;
    if (edgeOnly) {
      mask = new Uint8Array(w * h);
      var queue = new Int32Array(w * h);
      var head = 0, tail = 0;
      var limit = (t1 * 1.15) * klen2;   // 用同样的 keyness 度量做连通判断
      function keynessAt(p) {
        var i = p * 4;
        var gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        return ((data[i] - gray) * kdr + (data[i + 1] - gray) * kdg + (data[i + 2] - gray) * kdb) / klen2;
      }
      function push(p) { if (!mask[p] && keynessAt(p) > t0) { mask[p] = 1; queue[tail++] = p; } }
      var x, y;
      for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      void limit;
      while (head < tail) {
        var p = queue[head++], px = p % w, py = (p - px) / w;
        if (px > 0) push(p - 1);
        if (px < w - 1) push(p + 1);
        if (py > 0) push(p - w);
        if (py < h - 1) push(p + w);
      }
    }

    for (var i = 0; i < data.length; i += 4) {
      var pixel = i / 4;
      if (mask && !mask[pixel]) continue;
      var r = data[i], g = data[i + 1], b = data[i + 2];
      var gray = (r + g + b) / 3;
      var keyness = ((r - gray) * kdr + (g - gray) * kdg + (b - gray) * kdb) / klen2;
      if (keyness <= t0) continue;
      var alpha = keyness >= t1 ? 0 : 1 - (keyness - t0) / (t1 - t0);
      if (alpha <= 0.02) { data[i + 3] = 0; continue; }
      data[i + 3] = Math.round(data[i + 3] * alpha);
      // 去溢色：把残留的背景色成分从边缘像素里减掉，避免一圈彩边
      data[i] = Math.max(0, Math.min(255, (r - kr * (1 - alpha)) / alpha));
      data[i + 1] = Math.max(0, Math.min(255, (g - kg * (1 - alpha)) / alpha));
      data[i + 2] = Math.max(0, Math.min(255, (b - kb * (1 - alpha)) / alpha));
    }
  }

  /* ------------------------------------------------------------ 合成环境音 */
  function Ambience() {
    var ctx = null, gain = null, nodes = [], freqsKey = '';
    return {
      ensure: function () {
        if (ctx) return ctx;
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) throw new Error('AudioContext unavailable');
        ctx = new Ctor();
        gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        return ctx;
      },
      setFreqs: function (list) {
        var key = list.join(',');
        if (key === freqsKey) return;
        freqsKey = key;
        this.ensure();
        nodes.forEach(function (n) { try { n.stop(); } catch (e) { /* noop */ } });
        nodes = list.map(function (frequency, i) {
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = frequency;
          var level = ctx.createGain();
          level.gain.value = i === 0 ? 0.65 : 0.11;
          osc.connect(level);
          level.connect(gain);
          osc.start();
          return osc;
        });
      },
      volume: function (on, value) {
        if (!ctx) return;
        gain.gain.setTargetAtTime(on ? (value / 100) * 0.045 : 0, ctx.currentTime, 0.4);
      },
      resume: function () { return ctx && ctx.resume ? ctx.resume() : Promise.resolve(); },
      ready: function () { return !!ctx; },
      close: function () { if (ctx) { try { ctx.close(); } catch (e) { /* noop */ } ctx = null; } }
    };
  }

  /* ---------------------------------------------------------------- 播放器 */
  var DEFAULT_AMBIENCE = [55, 110, 164.8, 220.3];
  var DEFAULT_COPY = {
    savedStatus: '进度已自动保存',
    clickContinue: '点击继续',
    clickFull: '点击显示全文',
    autoPlaying: '自动播放中',
    skipping: '快进中',
    keyboardHint: '继续',
    keyboardHide: '隐藏界面',
    headphoneHint: '建议佩戴耳机体验',
    mobileHint: '轻触对话框，继续我们的故事',
    narratorLabel: '旁白',
    historyTitle: '故事回响',
    historyEyebrow: 'STORY LOG'
  };

  function createPlayer(root, project, options) {
    options = options || {};
    var P = normalizeProject(project);
    var copy = Object.assign({}, DEFAULT_COPY, (P.settings && P.settings.copy) || {});
    var storeKey = 'gal-studio:' + (P.id || 'project') + ':';
    var state = {
      index: 0, chars: 0, auto: false, skipping: false, hidden: false,
      panel: null, toast: '', sound: false, motion: true,
      speed: 32, delay: 3, volume: 35, saves: [], furthest: 0, titleShown: false
    };
    var listeners = {};
    var typingTimer = null, autoTimer = null, toastTimer = null, breath = true;
    var transient = !!options.transient;
    var ambience = Ambience();
    var audioEl = null;
    var currentAmbienceKey = '';
    var lastSpeakerId = null;
    var layersSignature = '';
    var destroyed = false;

    /* -------- 存储 -------- */
    function read(key, fallback) {
      try { var raw = localStorage.getItem(storeKey + key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    }
    function write(key, value) {
      // 编辑器预览是「临时会话」：不覆盖玩家真实的阅读进度
      if (transient && (key === 'progress' || key === 'furthest')) return true;
      try { localStorage.setItem(storeKey + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }

    /* -------- 索引工具 -------- */
    var chapterOrder = {}, chapterList = [], starts = [], lineChapter = [];
    function reindex() {
      chapterOrder = {}; chapterList = P.chapters.slice(); starts = []; lineChapter = [];
      chapterList.forEach(function (chapter, i) { chapterOrder[chapter.id] = i; starts[i] = -1; });
      P.lines.forEach(function (line, i) {
        var order = chapterOrder[line.chapterId];
        if (order == null) { order = 0; line.chapterId = chapterList[0] ? chapterList[0].id : ''; }
        lineChapter[i] = order;
        if (starts[order] === -1) starts[order] = i;
      });
      for (var i = 0; i < chapterList.length; i++) if (starts[i] === -1) starts[i] = Math.max(0, P.lines.length - 1);
    }
    function asset(id) { return (P.assetMap && P.assetMap[id]) || null; }
    function assetSrc(id) { var a = asset(id); return a ? a.src : ''; }
    function character(id) { return (P.characterMap && P.characterMap[id]) || null; }
    function chapterOf(line) { return chapterList[chapterOrder[line.chapterId]] || chapterList[0] || { number: '01', title: '', subtitle: '', description: '', level: '', location: '', backgroundId: '', tint: '', ambienceLabel: '' }; }
    function primaryCharacter() { return P.characters[0] || null; }
    /** 这一章是不是还没有台词（章节回廊里要显示成不可点，否则会跳到别的地方） */
    function isEmptyChapter(order) {
      var id = chapterList[order] ? chapterList[order].id : null;
      if (!id) return true;
      for (var i = 0; i < P.lines.length; i++) if (P.lines[i].chapterId === id) return false;
      return true;
    }
    function speakerOf(line) {
      var c = line.speakerId ? character(line.speakerId) : null;
      return c ? { id: c.id, name: c.name, en: c.nameEn || '', isCharacter: true } : { id: null, name: copy.narratorLabel, en: 'NARRATION', isCharacter: false };
    }
    function lastSpeakingBefore(index) {
      for (var i = index; i >= 0; i--) if (P.lines[i] && P.lines[i].speakerId) return P.lines[i].speakerId;
      return primaryCharacter() ? primaryCharacter().id : null;
    }
    function hasSprites(c) { return !!c && (c.expressions || []).some(function (e) { return e.assetId && assetSrc(e.assetId); }); }
    function spriteTarget(line, index) {
      var c = line.speakerId ? character(line.speakerId) : null;
      if (hasSprites(c)) return c;
      var last = character(lastSpeakingBefore(index));
      if (hasSprites(last)) return last;
      return P.characters.filter(hasSprites)[0] || c || primaryCharacter();
    }
    function expressionImage(char, expressionId) {
      if (!char) return { src: '', label: '' };
      var list = char.expressions || [];
      var found = null;
      for (var i = 0; i < list.length; i++) if (list[i].id === expressionId) found = list[i];
      if (!found || !found.assetId) found = list.filter(function (e) { return e.assetId; })[0] || null;
      if (!found) return { src: '', label: '', expression: null };
      return { src: assetSrc(found.assetId), label: found.label || '', expression: found };
    }
    function sceneImageFor(line) {
      if (line.presentation === 'cg' && line.cgAssetId) return assetSrc(line.cgAssetId);
      if (line.presentation === 'cg' && P.cg) return assetSrc(P.cg);
      return assetSrc(chapterOf(line).backgroundId);
    }
    function sceneThumbnail(line) {
      if (line.presentation === 'cg' && (line.cgAssetId || P.cg)) return assetSrc(line.cgAssetId || P.cg);
      return assetSrc(chapterOf(line).backgroundId);
    }
    function validIndex(value) {
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < P.lines.length ? value : 0;
    }

    /* -------- 主题 -------- */
    function themeVars() {
      var t = P.theme || {};
      var p = PRESETS[t.preset] || PRESETS.backrooms;
      var dialogAlpha = Math.max(0.35, Math.min(1, (t.dialogOpacity == null ? p.dialogOpacity : t.dialogOpacity) / 100));
      var accent = t.accent || p.accent;
      var accent2 = t.accent2 || p.accent2 || accent;
      var out = {
        '--gal-bg': t.background || p.background,
        '--gal-accent': accent,
        '--gal-accent-2': accent2,
        '--gal-accent-ink': t.accentInk || p.accentInk,
        '--gal-accent-soft': t.accentSoft || p.accentSoft || accent,
        '--gal-accent-glow': hexA(t.accentGlow || p.accentGlow || accent, 0.5),
        '--gal-ink': t.ink || p.ink,
        '--gal-text': t.text || p.text,
        '--gal-muted': t.muted || p.muted,
        '--gal-faint': t.faint || p.faint,
        '--gal-panel-a': hexA(t.panel || p.panel, dialogAlpha),
        '--gal-panel-b': hexA(t.panel2 || p.panel2 || t.panel || p.panel, Math.max(0.3, dialogAlpha - 0.05)),
        '--gal-panel-c': hexA(t.panel || p.panel, Math.max(0.3, dialogAlpha - 0.11)),
        '--gal-edge': hexA(t.edge || p.edge, 0.18),
        '--gal-edge-strong': hexA(t.edge || p.edge, 0.4),
        '--gal-frame-a': hexA(t.frame || p.frame, 0.97),
        '--gal-frame-b': hexA(t.frame2 || p.frame2 || t.frame || p.frame, 0.98),
        '--gal-dropdown-a': hexA(t.frame || p.frame, 0.99),
        '--gal-backdrop': hexA(p.backdrop, 0.65),
        '--gal-line': hexA(t.edge || p.edge, 0.11),
        '--gal-surface': hexA(t.panel || p.panel, 0.97),
        '--gal-chapter-veil-a': hexA(t.panel || p.panel, 0.97),
        '--gal-chapter-veil-b': hexA(t.panel2 || p.panel2 || p.panel, 0.87),
        '--gal-radius': (t.radius == null ? p.radius : t.radius) + 'px',
        '--gal-serif': t.font === 'sans' ? (t.sans || p.sans) : (t.serif || p.serif),
        '--gal-sans': t.sans || p.sans,
        '--gal-sprite-scale': (t.spriteScale == null ? 1 : t.spriteScale),
        '--gal-tint-strength': ((P.theme && P.theme.tintStrength) == null ? 0.75 : P.theme.tintStrength)
      };
      return out;
    }
    function hexA(hex, alpha) {
      var rgb = hexToRgb(hex);
      return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
    }
    // 变量挂在 :root 上，这样 body 背景、全屏留白等也能跟着换肤
    function applyThemeVars() {
      var vars = themeVars();
      var target = document.documentElement;
      Object.keys(vars).forEach(function (key) { target.style.setProperty(key, vars[key]); });
      document.documentElement.setAttribute('data-gal-preset', (P.theme && P.theme.preset) || 'backrooms');
    }
    var PRESETS = {
      backrooms: {
        background: '#171b14', accent: '#c2d1bc', accent2: '#a7c1ad', accentInk: '#233d32', accentSoft: '#c6d6b9',
        ink: '#eeeae0', text: '#d3ddca', muted: '#aab9aa', faint: '#859b89',
        panel: '#122520', panel2: '#11201d', edge: '#c2d0b9', frame: '#23372f', frame2: '#122721', backdrop: '#061411',
        radius: 3, dialogOpacity: 90, serif: "'Noto Serif SC','Songti SC','Source Han Serif SC',SimSun,serif", sans: "'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif"
      },
      midnight: {
        background: '#0d1420', accent: '#a9c3e6', accent2: '#7d9bc4', accentInk: '#16273d', accentSoft: '#bcd2ee',
        ink: '#e8eef7', text: '#ccd8e8', muted: '#9aa9bf', faint: '#74839a',
        panel: '#141f31', panel2: '#0f1a2a', edge: '#a9c3e6', frame: '#1b2942', frame2: '#101a2c', backdrop: '#050b16',
        radius: 4, dialogOpacity: 88, serif: "'Noto Serif SC','Songti SC',SimSun,serif", sans: "'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif"
      },
      sakura: {
        background: '#1d1418', accent: '#f0b3c4', accent2: '#d98ba3', accentInk: '#48202c', accentSoft: '#f7cbd7',
        ink: '#fdeef2', text: '#f0d6dd', muted: '#d0aeb8', faint: '#ab8892',
        panel: '#2b1a22', panel2: '#241620', edge: '#f0b3c4', frame: '#39222c', frame2: '#241620', backdrop: '#12080d',
        radius: 8, dialogOpacity: 86, serif: "'Noto Serif SC','Songti SC','STKaiti',KaiTi,serif", sans: "'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif"
      },
      noir: {
        background: '#141414', accent: '#d9d9d9', accent2: '#a8a8a8', accentInk: '#1a1a1a', accentSoft: '#efefef',
        ink: '#f4f4f4', text: '#dcdcdc', muted: '#a5a5a5', faint: '#7d7d7d',
        panel: '#1e1e1e', panel2: '#191919', edge: '#d9d9d9', frame: '#262626', frame2: '#1a1a1a', backdrop: '#050505',
        radius: 0, dialogOpacity: 92, serif: "Georgia,'Noto Serif SC','Songti SC',SimSun,serif", sans: "'Helvetica Neue',Arial,'Noto Sans SC','PingFang SC',sans-serif"
      },
      coast: {
        background: '#edf6f7', accent: '#167c83', accent2: '#449ea0', accentInk: '#ffffff', accentSoft: '#167c83',
        ink: '#183c45', text: '#24464f', muted: '#426970', faint: '#53747b',
        panel: '#f5fcfd', panel2: '#e7f3f4', edge: '#167c83', frame: '#f5fcfd', frame2: '#e7f3f4', backdrop: '#183c45',
        radius: 6, dialogOpacity: 94, serif: "'Noto Serif SC',SimSun,serif", sans: "'Noto Sans SC','Microsoft YaHei',system-ui,sans-serif"
      },
      neon: {
        background: '#151519', accent: '#ff8c96', accent2: '#67d8d4', accentInk: '#29171e', accentSoft: '#67d8d4',
        ink: '#f2f4f5', text: '#e2e4e9', muted: '#b9b7c5', faint: '#9a98aa',
        panel: '#25232b', panel2: '#1a1a20', edge: '#67d8d4', frame: '#25232b', frame2: '#1a1a20', backdrop: '#151519',
        radius: 0, dialogOpacity: 92, serif: "'Noto Serif SC',SimSun,serif", sans: "'Noto Sans SC','Microsoft YaHei',system-ui,sans-serif"
      },
      winter: {
        background: '#f3f5f2', accent: '#a83c4c', accent2: '#c56570', accentInk: '#ffffff', accentSoft: '#a83c4c',
        ink: '#293a38', text: '#334644', muted: '#526b65', faint: '#647970',
        panel: '#ffffff', panel2: '#edf2ef', edge: '#497a6c', frame: '#ffffff', frame2: '#edf2ef', backdrop: '#293a38',
        radius: 3, dialogOpacity: 97, serif: "'Noto Serif SC','Songti SC',SimSun,serif", sans: "'Noto Sans SC','Microsoft YaHei',system-ui,sans-serif"
      },
      paper: {
        background: '#efe7d8', accent: '#8a6a45', accent2: '#6f5436', accentInk: '#fdf9f0', accentSoft: '#a9895f',
        ink: '#3a2f24', text: '#4a3d2e', muted: '#6c5c48', faint: '#8b7a63',
        panel: '#fbf5e9', panel2: '#f6eddd', edge: '#8a6a45', frame: '#fdf8ee', frame2: '#f3e9d7', backdrop: '#3a2f24',
        radius: 2, dialogOpacity: 94, serif: "'Noto Serif SC','Songti SC','SimSun',serif", sans: "'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif"
      }
    };

    /* ------------------------------------------------------------ 构建 DOM */
    var dom = {};
    var ui = null;

    function build() {
      ui = node('main', 'game');
      ui.setAttribute('data-theme', (P.theme && P.theme.preset) || 'backrooms');
      ui.setAttribute('data-grain', P.theme.grain === false ? '0' : '1');
      ui.setAttribute('data-dust', P.theme.dust === false ? '0' : '1');
      ui.setAttribute('data-veil', P.theme.veil === 'off' ? '0' : P.theme.veil === 'soft' ? 'soft' : '1');
      ui.setAttribute('data-align', P.theme.align === 'center' ? 'center' : 'left');
      ui.setAttribute('data-dialoglayout', P.theme.layout === 'wide' ? 'wide' : 'bottom');
      applyThemeVars();

      ui.innerHTML =
        '<div class="scene">' +
          '<div class="scene-image event-cg" aria-hidden="true"></div>' +
          '<div class="scene-tint" aria-hidden="true"></div>' +
          '<div class="scene-shade" aria-hidden="true"></div>' +
          '<div class="scene-grain" aria-hidden="true"></div>' +
          '<div class="dust" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '</div>' +
        '<div class="game-interface">' +
          '<header class="topbar">' +
            '<button class="brand" data-action="menu">' +
              '<span class="brand-mark"><span></span><span></span><i></i></span>' +
              '<span class="brand-text"><span class="brand-title"></span><small class="brand-sub"></small></span>' +
            '</button>' +
            '<div class="top-actions">' +
              '<button class="chapter-nav" data-action="chapters">' + icon('book', 16) + '<span class="chapter-nav-text"></span></button>' +
              '<span class="saved-status"><i></i>' + esc(copy.savedStatus) + '</span>' +
              '<span class="top-divider"></span>' +
              '<button class="icon-button fullscreen" data-action="fullscreen" aria-label="切换全屏" title="全屏">' + icon('expand', 19) + '</button>' +
              '<button class="icon-button" data-action="menu" aria-label="打开菜单" title="菜单">' + icon('menu', 23) + '</button>' +
            '</div>' +
          '</header>' +
          '<aside class="chapter-intro">' +
            '<div class="level-label"><span class="level-dot"></span><span class="level-name"></span><span class="label-slash">/</span><span class="level-location"></span></div>' +
            '<div class="intro-rule"></div>' +
            '<p class="chapter-eyebrow"><span class="chapter-number"></span><span class="chapter-eyebrow-line"></span><span class="chapter-title"></span></p>' +
            '<h1 class="chapter-subtitle"></h1>' +
            '<p class="intro-description"></p>' +
            '<div class="chapter-indicators"></div>' +
          '</aside>' +
          '<div class="side-note"><span></span><b class="side-note-text"></b><i>×</i><b class="side-note-sub"></b><span></span></div>' +
          '<div class="scene-caption"><span class="small-cross">+</span><span>SCENE <b class="caption-number"></b><br><b class="caption-location"></b></span></div>' +
          '<section class="reading-area" aria-label="剧情阅读">' +
            '<div class="dialogue-topline">' +
              '<span class="connection"><i></i><span class="connection-text"></span></span>' +
              '<button class="hide-button" data-action="hide" title="隐藏界面 · H">' + icon('eye', 15) + '<span>隐藏界面</span></button>' +
            '</div>' +
            '<div class="dialogue-box" data-action="next">' +
              '<div class="speaker-tag"><span class="speaker-diamond"></span><strong class="speaker-name"></strong><span class="speaker-en"></span><span class="expression-mark"></span></div>' +
              '<div class="dialogue-decoration">“</div>' +
              '<p class="dialogue-text" aria-live="off"></p>' +
              '<div class="dialogue-bottom">' +
                '<span class="line-number"><span></span><b class="line-chapter"></b><i>·</i><b class="line-index"></b></span>' +
                '<button class="continue-button" data-action="next"><span class="continue-label"></span><span class="next-diamond">' + icon('arrow', 14) + '</span></button>' +
              '</div>' +
            '</div>' +
            '<div class="playback-bar">' +
              '<button class="ambience" data-action="sound" aria-pressed="false">' +
                '<span class="sound-icon"></span>' +
                '<span class="ambience-text"><small>AMBIENCE</small><span class="ambience-label"><b class="ambience-name"></b><i></i></span></span>' +
                '<span class="waveform"></span>' +
              '</button>' +
              '<nav class="controls" aria-label="游戏控制">' +
                '<button class="control" data-action="history" title="回看 · L">' + icon('history', 17) + '<span>回看</span></button>' +
                '<button class="control" data-action="auto" title="自动 · A">' + icon('play', 17) + '<span>自动</span><i class="active-dot" hidden></i></button>' +
                '<button class="control" data-action="skip" title="快进">' + icon('skip', 17) + '<span>快进</span><i class="active-dot" hidden></i></button>' +
                '<span class="control-divider"></span>' +
                '<button class="control" data-action="save">' + icon('save', 17) + '<span>存档</span></button>' +
                '<button class="control" data-action="load">' + icon('load', 17) + '<span>读档</span></button>' +
                '<button class="control" data-action="settings">' + icon('settings', 17) + '<span>设置</span></button>' +
              '</nav>' +
            '</div>' +
            '<footer class="bottom-bar">' +
              '<span class="keyboard-tips"><kbd>SPACE</kbd>' + esc(copy.keyboardHint) + '<span>·</span><kbd>H</kbd>' + esc(copy.keyboardHide) + '<span>·</span>' + esc(copy.headphoneHint) + '</span>' +
              '<span class="mobile-tip">' + esc(copy.mobileHint) + '</span>' +
              '<span class="story-progress"><b class="progress-label"></b><span></span><b class="progress-number"></b><i class="progress-total"></i></span>' +
            '</footer>' +
          '</section>' +
          '<div class="page-progress"><span></span></div>' +
        '</div>' +
        '<button class="restore-ui" data-action="restore" hidden>' + icon('eye', 16) + '显示界面 <kbd>H</kbd></button>' +
        '<div class="toast" role="status" hidden>' + icon('check', 17) + '<span></span></div>' +
        '<div class="modal-backdrop" hidden><div class="modal" role="dialog" aria-modal="true" tabindex="-1"></div></div>';

      root.appendChild(ui);
      cacheDom();
      buildSceneLayers();
      bindEvents();
      return ui;
    }

    function cacheDom() {
      var q = function (sel) { return ui.querySelector(sel); };
      dom.scene = q('.scene');
      dom.cg = q('.event-cg');
      dom.tint = q('.scene-tint');
      dom.iface = q('.game-interface');
      dom.brandTitle = q('.brand-title');
      dom.brandSub = q('.brand-sub');
      dom.chapterNavText = q('.chapter-nav-text');
      dom.intro = q('.chapter-intro');
      dom.levelName = q('.level-name');
      dom.levelLocation = q('.level-location');
      dom.chapterNumber = q('.chapter-number');
      dom.chapterTitle = q('.chapter-title');
      dom.chapterSubtitle = q('.chapter-subtitle');
      dom.introDescription = q('.intro-description');
      dom.indicators = q('.chapter-indicators');
      dom.sideNoteText = q('.side-note-text');
      dom.sideNoteSub = q('.side-note-sub');
      dom.captionNumber = q('.caption-number');
      dom.captionLocation = q('.caption-location');
      dom.connectionText = q('.connection-text');
      dom.speakerTag = q('.speaker-tag');
      dom.speakerName = q('.speaker-name');
      dom.speakerEn = q('.speaker-en');
      dom.expressionMark = q('.expression-mark');
      dom.text = q('.dialogue-text');
      dom.lineChapter = q('.line-chapter');
      dom.lineIndex = q('.line-index');
      dom.continueLabel = q('.continue-label');
      dom.nextDiamond = q('.next-diamond');
      dom.ambienceBtn = q('.ambience');
      dom.soundIcon = q('.sound-icon');
      dom.ambienceName = q('.ambience-name');
      dom.waveform = q('.waveform');
      dom.controlAuto = ui.querySelector('[data-action="auto"]');
      dom.controlSkip = ui.querySelector('[data-action="skip"]');
      dom.progressLabel = q('.progress-label');
      dom.progressNumber = q('.progress-number');
      dom.progressTotal = q('.progress-total');
      dom.pageProgress = q('.page-progress > span');
      dom.restore = q('.restore-ui');
      dom.toast = q('.toast');
      dom.toastText = q('.toast span');
      dom.backdrop = q('.modal-backdrop');
      dom.modal = q('.modal');
      dom.waveform.innerHTML = Array.from({ length: 12 }, function (_, i) {
        return '<i style="height:' + (5 + ((i * 7) % 15)) + 'px;animation-delay:' + (i * 0.12) + 's"></i>';
      }).join('');
    }

    var bgLayers = {}, stages = {};
    function buildSceneLayers() {
      // 背景层与立绘必须是 .scene 的直接子元素，才能命中原引擎样式里的层级规则
      Object.keys(bgLayers).forEach(function (id) { if (bgLayers[id].parentNode) bgLayers[id].parentNode.removeChild(bgLayers[id]); });
      Object.keys(stages).forEach(function (id) { if (stages[id].parentNode) stages[id].parentNode.removeChild(stages[id]); });
      bgLayers = {}; stages = {};
      P.chapters.forEach(function (chapter) {
        var layer = node('div', 'scene-image scene-bg');
        layer.setAttribute('data-chapter', chapter.id);
        layer.setAttribute('aria-hidden', 'true');
        layer.style.backgroundImage = assetSrc(chapter.backgroundId) ? 'url("' + assetSrc(chapter.backgroundId) + '")' : 'none';
        dom.scene.insertBefore(layer, dom.cg);
        bgLayers[chapter.id] = layer;
      });
      P.characters.forEach(function (character_) {
        var stage = node('div', 'character-stage');
        stage.setAttribute('data-slot', character_.slot || 'right');
        stage.setAttribute('data-character', character_.id);
        stage.appendChild(node('div', 'character-breath'));
        dom.scene.insertBefore(stage, dom.cg);
        stages[character_.id] = stage;
      });
      dom.indicators.innerHTML = '';
      P.chapters.forEach(function (chapter, i) {
        var dot = node('button', '');
        dot.setAttribute('aria-label', '第' + (i + 1) + '章：' + (chapter.title || ''));
        dot.addEventListener('click', function () { openPanel('chapters'); });
        dom.indicators.appendChild(dot);
      });
      spriteLoaded = {};
    }
    var spriteLoaded = {};

    /* ------------------------------------------------------------ 立绘加载 */
    function ensureSprites() {
      P.characters.forEach(function (character_) {
        var stage = stages[character_.id];
        if (!stage) return;
        var holder = stage.querySelector('.character-breath');
        (character_.expressions || []).forEach(function (expression) {
          if (!expression.assetId) return;
          var src = assetSrc(expression.assetId);
          if (!src) return;
          if (holder.querySelector('[data-expression="' + cssEscape(expression.id) + '"]')) return;
          var img = node('img', 'character-art');
          img.alt = '';
          img.draggable = false;
          img.setAttribute('data-expression', expression.id);
          holder.appendChild(img);
          var useKey = expression.keyOut !== false;
          var job = useKey
            ? keyOut(src, expression.keyColor || '#ff00ff', expression.tolerance == null ? 110 : expression.tolerance, !!expression.edgeOnly)
            : Promise.resolve(src);
          job.then(function (url) {
            if (destroyed) return;
            img.src = url;
            img.dataset.ready = '1';
            spriteLoaded[character_.id] = true;
            refreshSprites();
          }).catch(function () {
            if (destroyed) return;
            img.src = src;                     // 抠图失败就直接用原图，不让立绘消失
            img.dataset.ready = '1';
            refreshSprites();
          });
        });
      });
    }
    function refreshSprites() {
      var line = P.lines[state.index];
      if (line) renderSprites(line, speakerOf(line));
    }
    function cssEscape(value) { return String(value).replace(/["\\]/g, '\\$&'); }

    /* ---------------------------------------------------------------- 渲染 */
    function renderLine() {
      var line = P.lines[state.index];
      if (!line) return;
      var chapter = chapterOf(line);
      var order = chapterOrder[line.chapterId] == null ? 0 : chapterOrder[line.chapterId];
      var speaker = speakerOf(line);
      var text = line.text || '';

      ui.className = 'game chapter-' + order + (line.presentation === 'cg' ? ' is-event' : '') + (state.motion ? '' : ' reduce-motion');
      ui.setAttribute('data-theme', (P.theme && P.theme.preset) || 'backrooms');

      // 背景层
      P.chapters.forEach(function (chapter) {
        var layer = bgLayers[chapter.id];
        if (layer) layer.classList.toggle('visible', chapter.id === line.chapterId);
      });
      // 氛围色
      if (chapter.tint) {
        dom.tint.style.background = chapter.tint;
        dom.tint.style.setProperty('--gal-tint-strength', chapter.tintStrength == null ? (P.theme.tintStrength == null ? 0.75 : P.theme.tintStrength) : chapter.tintStrength);
        dom.tint.classList.add('visible');
      } else {
        dom.tint.classList.remove('visible');
      }
      // 事件 CG
      var cgSrc = line.presentation === 'cg' ? assetSrc(line.cgAssetId || P.cg) : '';
      if (cgSrc) dom.cg.style.backgroundImage = 'url("' + cgSrc + '")';
      dom.cg.classList.toggle('visible', !!cgSrc);

      renderSprites(line, speaker);

      // 章节信息
      dom.levelName.textContent = chapter.level || ('CHAPTER ' + (order + 1));
      dom.levelLocation.textContent = chapter.location || '';
      dom.chapterNumber.textContent = chapter.number || String(order + 1).padStart(2, '0');
      dom.chapterTitle.textContent = chapter.title || '';
      dom.chapterSubtitle.innerHTML = String(chapter.subtitle || '').split('\n').map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
      dom.introDescription.textContent = chapter.description || '';
      dom.captionNumber.textContent = chapter.number || String(order + 1).padStart(2, '0');
      dom.captionLocation.textContent = chapter.location || '';
      dom.chapterNavText.textContent = 'CHAPTER ' + (chapter.number || String(order + 1).padStart(2, '0'));
      dom.lineChapter.textContent = chapter.title || '';
      dom.lineIndex.textContent = String(state.index + 1).padStart(3, '0');
      Array.prototype.forEach.call(dom.indicators.children, function (dot, i) {
        dot.classList.toggle('current', i === order);
        dot.disabled = starts[i] > state.furthest;
      });

      // 说话人
      var isNarrator = !speaker.isCharacter;
      dom.speakerName.textContent = speaker.name;
      dom.speakerEn.textContent = speaker.en || (speaker.isCharacter ? '' : 'NARRATION');
      dom.speakerTag.className = 'speaker-tag' + (isNarrator ? ' narrator' : ' character-tag');
      dom.expressionMark.innerHTML = speaker.isCharacter ? icon('star', 11) : '';
      dom.text.className = 'dialogue-text' + (isNarrator ? ' narration-text' : '');

      // 文本（打字机按需补足）
      paintText(text);

      // 氛围音
      applyAmbience(chapter);

      // 进度条
      var ratio = P.lines.length <= 1 ? 1 : (state.index + 1) / P.lines.length;
      dom.pageProgress.style.width = (ratio * 100) + '%';
      dom.progressNumber.textContent = String(order + 1).padStart(2, '0');
      dom.progressTotal.textContent = '/ ' + String(P.chapters.length).padStart(2, '0');
      dom.progressLabel.textContent = P.settings.progressLabel || ('第 ' + P.lines.length + ' 句 · 共 ' + P.chapters.length + ' 章');
    }

    function renderSprites(line, speaker) {
      var target = line.presentation === 'sprite' ? spriteTarget(line, state.index) : null;
      var want = line.presentation === 'sprite' && target ? expressionImage(target, line.expressionId) : { src: '', expression: null };
      P.characters.forEach(function (character_) {
        var stage = stages[character_.id];
        if (!stage) return;
        var active = !!target && character_.id === target.id && line.presentation === 'sprite';
        stage.classList.toggle('is-present', active);
        stage.classList.toggle('is-speaking', active && speaker.isCharacter && speaker.id === character_.id);
        if (!active) { stage.dataset.wanted = ''; return; }
        var wanted = want.expression ? want.expression.id : '';
        var img = stage.querySelector('[data-expression="' + cssEscape(wanted) + '"]');
        if (!img) {
          var first = stage.querySelector('.character-art[data-ready]');
          if (first) { wanted = first.getAttribute('data-expression'); img = first; }
        }
        stage.dataset.wanted = wanted || '';
        Array.prototype.forEach.call(stage.querySelectorAll('.character-art'), function (art) {
          art.classList.toggle('is-current', art === img && !!art.dataset.ready);
        });
        stage.setAttribute('data-expression', wanted || '');
      });
    }

    function paintText(text) {
      dom.text.textContent = text.slice(0, state.chars);
      var cursor = node('span', 'typing-cursor' + (state.chars >= text.length ? ' done' : ''));
      dom.text.appendChild(cursor);
      var complete = state.chars >= text.length;
      dom.continueLabel.textContent = state.skipping ? copy.skipping : state.auto ? copy.autoPlaying : complete ? copy.clickContinue : copy.clickFull;
      dom.nextDiamond.classList.toggle('ready', complete);
    }

    function startTyping() {
      if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
      var line = P.lines[state.index];
      if (!line) return;
      var text = line.text || '';
      if (!state.motion || state.skipping) { state.chars = text.length; paintText(text); scheduleAuto(); return; }
      var step = Math.max(6, 76 - state.speed);
      typingTimer = setInterval(function () {
        state.chars = Math.min(state.chars + 1, text.length);
        paintText(text);
        if (state.chars >= text.length) {
          clearInterval(typingTimer); typingTimer = null;
          scheduleAuto();
        }
      }, step);
    }

    function completeTyping() {
      var line = P.lines[state.index];
      if (!line) return;
      if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
      state.chars = (line.text || '').length;
      paintText(line.text || '');
      scheduleAuto();
    }

    /* ---------------------------------------------------------- 播放控制 */
    function next() {
      if (state.hidden) { state.hidden = false; renderInterface(); return; }
      var line = P.lines[state.index];
      if (!line) return;
      if (state.chars < (line.text || '').length) { completeTyping(); return; }
      if (state.index < P.lines.length - 1) goto(state.index + 1);
      else { state.auto = false; state.skipping = false; renderControls(); openPanel('ending'); }
    }
    function prev() {
      state.auto = false; state.skipping = false;
      goto(Math.max(0, state.index - 1));
    }
    function goto(index, silent) {
      index = validIndex(Number(index));
      state.index = index;
      state.chars = 0;
      state.furthest = Math.max(state.furthest, index);
      write('progress', index);
      write('furthest', state.furthest);
      renderLine();
      renderControls();
      startTyping();
      if (!silent) emit('index', { index: index });
      scheduleAuto();
    }
    function scheduleAuto() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      if (state.panel || (!state.auto && !state.skipping) || state.hidden) return;
      var line = P.lines[state.index];
      if (!line) return;
      if (state.chars < (line.text || '').length) return;
      autoTimer = setTimeout(next, state.skipping ? 500 : state.delay * 1000);
    }

    /* ------------------------------------------------------------ 环境音 */
    function applyAmbience(chapter) {
      var label = chapter.ambienceLabel || P.settings.ambienceLabel || '环境音';
      dom.ambienceName.textContent = label;
      var assetId = chapter.ambienceAssetId;
      var key = assetId ? 'asset:' + assetId : 'synth:' + (chapter.ambienceFreqs || DEFAULT_AMBIENCE).join(',');
      if (key === currentAmbienceKey) return;
      currentAmbienceKey = key;
      if (assetId) {
        if (audioEl) { audioEl.pause(); audioEl = null; }
        audioEl = new Audio(assetSrc(assetId));
        audioEl.loop = true;
        audioEl.volume = state.sound ? state.volume / 100 : 0;
        if (state.sound) audioEl.play().catch(noop);
      } else {
        if (audioEl) { audioEl.pause(); audioEl = null; }
        if (ambience.ready()) {
          ambience.setFreqs(chapter.ambienceFreqs && chapter.ambienceFreqs.length ? chapter.ambienceFreqs : DEFAULT_AMBIENCE);
          ambience.volume(state.sound, state.volume);
        }
      }
    }
    function toggleSound() {
      try {
        if (audioEl) {
          state.sound = !state.sound;
          if (state.sound) audioEl.play().catch(noop); else audioEl.pause();
          audioEl.volume = state.volume / 100;
        } else {
          ambience.ensure();
          var chapter = P.lines[state.index] ? chapterOf(P.lines[state.index]) : {};
          ambience.setFreqs(chapter.ambienceFreqs && chapter.ambienceFreqs.length ? chapter.ambienceFreqs : DEFAULT_AMBIENCE);
          state.sound = !state.sound;
          ambience.volume(state.sound, state.volume);
          Promise.resolve(ambience.resume()).catch(noop);
        }
        renderControls();
      } catch (e) { notify('当前浏览器暂不支持环境音播放'); }
    }

    /* ------------------------------------------------------------ 界面状态 */
    function renderInterface() {
      dom.iface.classList.toggle('is-hidden', state.hidden);
      dom.restore.hidden = !state.hidden;
      dom.toast.hidden = !state.toast;
      dom.toastText.textContent = state.toast;
      dom.backdrop.hidden = !state.panel;
      if (state.panel) renderPanel();
    }
    function renderControls() {
      dom.controlAuto.classList.toggle('active', state.auto);
      dom.controlSkip.classList.toggle('active', state.skipping);
      dom.controlAuto.querySelector('.active-dot').hidden = !state.auto;
      dom.controlSkip.querySelector('.active-dot').hidden = !state.skipping;
      dom.controlAuto.querySelector('svg').outerHTML = icon(state.auto ? 'pause' : 'play', 17);
      dom.controlSkip.querySelector('svg').outerHTML = icon(state.skipping ? 'pause' : 'skip', 17);
      dom.soundIcon.innerHTML = icon(state.sound ? 'sound' : 'muted', 18);
      dom.ambienceBtn.classList.toggle('playing', state.sound);
      dom.ambienceBtn.setAttribute('aria-pressed', String(state.sound));
      dom.waveform.classList.toggle('on', state.sound);
      ui.classList.toggle('reduce-motion', !state.motion);
      var line = P.lines[state.index];
      if (line) paintText(line.text || '');
    }
    function notify(message) {
      state.toast = message;
      renderInterface();
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { state.toast = ''; renderInterface(); }, 2800);
    }
    function emit(event, payload) { (listeners[event] || []).forEach(function (fn) { try { fn(payload); } catch (e) { /* noop */ } }); }

    /* ------------------------------------------------------------- 模态框 */
    function panelTitles() {
      return {
        history: ['故事回响', 'STORY LOG'],
        save: ['保存记忆', 'SAVE MEMORY'],
        load: ['拾起记忆', 'LOAD MEMORY'],
        settings: ['你的阅读方式', 'PREFERENCES'],
        menu: ['片刻停留', 'PAUSE MENU'],
        chapters: ['迷失的轨迹', 'CHAPTERS'],
        ending: [P.settings.endingTitle || '故事到这里。', P.settings.endingEyebrow || 'THE END'],
        title: [P.title || '未命名作品', P.subtitle || 'A VISUAL NOVEL']
      };
    }
    function openPanel(name) {
      state.panel = name;
      state.skipping = false;
      renderInterface();
      if (name === 'history') {
        var list = dom.modal.querySelector('.history-list');
        if (list) list.scrollTop = list.scrollHeight;
      }
      try { dom.modal.focus(); } catch (e) { /* noop */ }
    }
    function closePanel() { state.panel = null; renderInterface(); scheduleAuto(); }

    function loadSaves() {
      var raw = read('saves', []);
      var count = Math.max(1, Math.min(20, (P.settings && P.settings.saves) || 6));
      return Array.from({ length: count }, function (_, i) {
        var s = Array.isArray(raw) ? raw[i] : null;
        return s && typeof s.date === 'string' && s.index === validIndex(s.index) ? s : null;
      });
    }
    function saveSlot(slot) {
      var saves = loadSaves();
      saves[slot] = { index: state.index, date: new Date().toISOString() };
      if (write('saves', saves)) { state.saves = saves; notify('已保存至记忆 ' + String(slot + 1).padStart(2, '0')); renderPanel(); }
      else notify('浏览器存储空间不足，暂时无法保存');
    }

    function renderPanel() {
      var panel = state.panel;
      if (!panel) return;
      var titles = panelTitles()[panel] || ['', ''];
      var head = '<header class="modal-header"><div><span class="modal-eyebrow">' + esc(titles[1]) + '</span><h2 id="modal-title">' + esc(titles[0]) + '</h2></div>' +
        '<button class="icon-button" data-action="close" aria-label="关闭面板">' + icon('close', 22) + '</button></header>';
      dom.modal.className = 'modal modal-' + panel;
      dom.modal.innerHTML = head + bodyFor(panel);
      bindModal();
    }
    function bodyFor(panel) {
      var i, line;
      if (panel === 'title') {
        var hasProgress = state.furthest > 0;
        return '<div class="ending-content modal-title-screen">' +
          '<div class="ending-stars">' + icon('star', 36) + icon('star', 22) + '</div>' +
          '<p>' + richText(P.settings.titleTagline || P.tagline || P.description || '') + '</p>' +
          '<span class="ending-rule"></span>' +
          '<button class="menu-primary" data-action="start">' + icon('play') + '开始阅读' + icon('arrow') + '</button>' +
          (hasProgress ? '<button class="ending-secondary" data-action="resume">继续上次的进度 · 第 ' + (state.furthest + 1) + ' 句</button>' : '') +
          '<p class="ending-thanks"><small>' + esc(P.author || '') + '</small></p>' +
        '</div>';
      }
      if (panel === 'history') {
        var rows = '';
        for (i = 0; i <= state.index && i < P.lines.length; i++) {
          line = P.lines[i];
          var speaker = speakerOf(line);
          rows += '<div class="history-line' + (speaker.isCharacter ? '' : ' is-narrator') + '">' +
            '<span class="history-index">' + String(i + 1).padStart(3, '0') + '</span>' +
            '<div><strong>' + esc(speaker.name) + '</strong><p>' + esc(line.text) + '</p></div>' +
            '<button data-action="jump" data-index="' + i + '" title="回到这句剧情" aria-label="回到第' + (i + 1) + '句剧情">' + icon('back', 16) + '</button>' +
            '</div>';
        }
        return '<p class="modal-description">那些说过的话，都留在这里。</p><div class="history-list">' + rows + '</div>' +
          '<p class="modal-footnote">点击句末的箭头，可以重新经历这一刻。</p>';
      }
      if (panel === 'save' || panel === 'load') {
        var saves = loadSaves();
        var grid = saves.map(function (save, slot) {
          var thumb = save ? sceneThumbnail(P.lines[save.index]) : '';
          var chapter = save ? chapterOf(P.lines[save.index]) : null;
          var spriteChar = save && P.lines[save.index].presentation === 'sprite' ? spriteTarget(P.lines[save.index], save.index) : null;
          var spriteImg = '';
          if (spriteChar) {
            var info = expressionImage(spriteChar, P.lines[save.index].expressionId);
            if (info.src) spriteImg = '<div class="character-stage is-present is-miniature"><div class="character-breath">' +
              '<img class="character-art is-current" src="' + esc(info.src) + '" alt=""></div></div>';
          }
          return '<button class="save-slot' + (save ? ' filled' : '') + '" data-action="' + (panel === 'save' ? 'save' : 'load') + '" data-index="' + slot + '"' + (panel === 'load' && !save ? ' disabled' : '') + '>' +
            '<div class="slot-image" style="' + (thumb ? 'background-image:url(&quot;' + esc(thumb) + '&quot;)' : '') + '">' + spriteImg +
            '<span class="slot-number">MEMORY ' + String(slot + 1).padStart(2, '0') + '</span>' +
            (save ? '<span class="slot-chapter">CHAPTER ' + esc(chapter.number || '') + '</span>' : icon('star', 27)) +
            '</div>' +
            '<div class="slot-info"><strong>' + esc(save ? (chapter.title || '') : '尚未留下记忆') + '</strong>' +
            '<small>' + esc(save ? formatDate(save.date) + ' · 第 ' + (save.index + 1) + ' 句' : (panel === 'save' ? '点击保存当前进度' : '空存档')) + '</small></div>' +
            '</button>';
        }).join('');
        return '<div class="save-tabs">' +
          '<button class="' + (panel === 'save' ? 'selected' : '') + '" data-action="panel" data-panel="save">保存记忆</button>' +
          '<button class="' + (panel === 'load' ? 'selected' : '') + '" data-action="panel" data-panel="load">读取记忆</button>' +
          '</div>' +
          '<p class="modal-description">' + (panel === 'save' ? '选择一个位置，留住此刻。已有记忆会被当前进度覆盖。' : '选择一段记忆，回到还牵着手的那一刻。') + '</p>' +
          '<div class="save-grid">' + grid + '</div>' +
          '<p class="modal-footnote">' + icon('save', 13) + '记忆保存在此设备的浏览器中，清除浏览器数据会删除存档。</p>';
      }
      if (panel === 'settings') {
        return '<div class="settings-list">' +
          '<p class="modal-description">让这个世界，以你喜欢的节奏展开。</p>' +
          settingRange('文字显示速度', '逐字呈现的快慢', 'speed', 5, 70, state.speed, state.speed < 25 ? '缓慢' : state.speed < 50 ? '适中' : '快速') +
          settingRange('自动播放间隔', '文字显示完毕后的停留时间', 'delay', 1, 8, state.delay, state.delay + ' 秒') +
          settingRange('环境音量', '轻柔的合成氛围音', 'volume', 0, 100, state.volume, state.volume + '%') +
          settingToggle('播放环境音', '戴上耳机，听见寂静', 'sound', state.sound) +
          settingToggle('沉浸动态效果', '场景光尘与逐字显示；关闭后文字即时呈现', 'motion', state.motion) +
          '<p class="modal-footnote">所有设置会自动保存</p>' +
          '</div>';
      }
      if (panel === 'chapters') {
        var cards = P.chapters.map(function (chapter, i) {
          var empty = isEmptyChapter(i);
          var locked = empty || starts[i] > state.furthest;
          var bg = assetSrc(chapter.backgroundId);
          return '<button class="chapter-card' + (lineChapter[state.index] === i ? ' selected' : '') + '" data-action="chapter" data-index="' + i + '"' + (locked ? ' disabled' : '') +
            ' style="background-image:linear-gradient(90deg,var(--gal-chapter-veil-a),var(--gal-chapter-veil-b)),url(&quot;' + esc(bg) + '&quot;)">' +
            '<span class="chapter-card-number">' + esc(chapter.number || String(i + 1).padStart(2, '0')) + '</span>' +
            '<span class="chapter-card-title"><small>' + esc((chapter.level || '') + (chapter.location ? ' / ' + chapter.location : '')) + '</small>' +
            '<strong>' + esc(chapter.title || '') + '</strong>' +
            '<span>' + (empty ? '这一章还没有内容' : locked ? '等待与你相遇' : lineChapter[state.index] === i ? '正在经历' : '重温这一章') + '</span></span>' +
            (locked ? '<span class="locked-dot">· · ·</span>' : icon('arrow')) +
            '</button>';
        }).join('');
        return '<p class="modal-description">' + P.chapters.length + ' 个章节，一条通往结局的路。读过的章节可以随时重温。</p>' +
          '<div class="chapter-list">' + cards + '</div>' +
          '<p class="modal-footnote">' + esc(P.settings.chaptersFootnote || '点击任意已解锁的章节即可跳转') + '</p>';
      }
      if (panel === 'menu') {
        return '<p class="modal-description">世界可以等一等。故事也是。</p>' +
          '<div class="menu-buttons">' +
          '<button class="menu-primary" data-action="close">' + icon('play') + '继续我们的故事' + icon('arrow') + '</button>' +
          '<button data-action="panel" data-panel="chapters">' + icon('book') + '章节回廊<span>CHAPTERS</span></button>' +
          '<button data-action="panel" data-panel="save">' + icon('save') + '保存记忆<span>SAVE</span></button>' +
          '<button data-action="panel" data-panel="load">' + icon('load') + '读取记忆<span>LOAD</span></button>' +
          '<button data-action="panel" data-panel="settings">' + icon('settings') + '阅读设置<span>SETTINGS</span></button>' +
          '<button data-action="restart">' + icon('history') + '重新阅读<span>RESTART</span></button>' +
          '</div>' +
          '<div class="menu-note"><span>' + esc(P.title || '') + '</span><small>' + esc(P.description || P.tagline || '') + '</small></div>';
      }
      if (panel === 'ending') {
        var ending = P.settings.endingText || '故事到这里结束。<br>谢谢你陪他们走到最后。';
        return '<div class="ending-content">' +
          '<div class="ending-stars">' + icon('star', 36) + icon('star', 22) + '</div>' +
          '<p>' + richText(ending) + '</p><span class="ending-rule"></span>' +
          '<p class="ending-thanks">' + esc(P.settings.endingThanks || '') + '<small>' + esc(P.settings.endingFootnote || '') + '</small></p>' +
          '<button class="menu-primary" data-action="restart">重新阅读' + icon('arrow') + '</button>' +
          '<button class="ending-secondary" data-action="panel" data-panel="history">回看我们的故事</button>' +
          '</div>';
      }
      return '';
    }
    function settingRange(label, hint, key, min, max, value, display) {
      return '<label class="setting-row"><span><strong>' + esc(label) + '</strong><small>' + esc(hint) + '</small></span>' +
        '<div class="range-wrap"><input type="range" data-setting="' + key + '" min="' + min + '" max="' + max + '" value="' + value + '" aria-label="' + esc(label) + '"><output>' + esc(display) + '</output></div></label>';
    }
    function settingToggle(label, hint, key, on) {
      return '<div class="setting-row"><span><strong>' + esc(label) + '</strong><small>' + esc(hint) + '</small></span>' +
        '<button class="toggle' + (on ? ' on' : '') + '" data-toggle="' + key + '" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '"><span></span></button></div>';
    }
    function formatDate(iso) {
      var d = new Date(iso);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    /* -------------------------------------------------------------- 事件 */
    function bindModal() {
      dom.modal.querySelectorAll('[data-action]').forEach(function (element) {
        element.addEventListener('click', function (event) {
          event.stopPropagation();
          var action = element.getAttribute('data-action');
          var index = Number(element.getAttribute('data-index'));
          if (action === 'close') closePanel();
          else if (action === 'panel') { openPanel(element.getAttribute('data-panel')); }
          else if (action === 'jump') { closePanel(); goto(index); }
          else if (action === 'chapter') { closePanel(); goto(starts[index]); }
          else if (action === 'save') saveSlot(index);
          else if (action === 'load') {
            var saves = loadSaves();
            if (saves[index]) { closePanel(); goto(saves[index].index); notify('已读取这段记忆'); }
          } else if (action === 'restart') { closePanel(); state.furthest = 0; goto(0); notify('每一次相遇，都值得重新开始'); }
          else if (action === 'start') { state.titleShown = true; closePanel(); goto(0); }
          else if (action === 'resume') { state.titleShown = true; closePanel(); goto(state.furthest); }
        });
      });
      dom.modal.querySelectorAll('[data-setting]').forEach(function (input) {
        input.addEventListener('input', function () {
          var key = input.getAttribute('data-setting');
          state[key] = Number(input.value);
          write(key, state[key]);
          if (key === 'volume') { if (audioEl) audioEl.volume = state.sound ? state.volume / 100 : 0; ambience.volume(state.sound, state.volume); }
          if (key === 'speed' || key === 'delay') { startTyping(); }
          var output = input.parentElement.querySelector('output');
          if (output) output.textContent = key === 'speed' ? (state.speed < 25 ? '缓慢' : state.speed < 50 ? '适中' : '快速') : key === 'delay' ? state.delay + ' 秒' : state.volume + '%';
        });
      });
      dom.modal.querySelectorAll('[data-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
          var key = button.getAttribute('data-toggle');
          if (key === 'sound') toggleSound();
          else if (key === 'motion') { state.motion = !state.motion; write('motion', state.motion); renderControls(); }
          renderPanel();
        });
      });
    }

    function bindEvents() {
      ui.addEventListener('click', function (event) {
        var target = event.target.closest('[data-action]');
        if (!target || target.closest('.modal')) return;
        var action = target.getAttribute('data-action');
        if (action === 'next') next();
        else if (action === 'menu') openPanel('menu');
        else if (action === 'chapters') openPanel('chapters');
        else if (action === 'history') openPanel('history');
        else if (action === 'save') openPanel('save');
        else if (action === 'load') openPanel('load');
        else if (action === 'settings') openPanel('settings');
        else if (action === 'sound') toggleSound();
        else if (action === 'hide') { state.hidden = true; renderInterface(); }
        else if (action === 'restore') { state.hidden = false; renderInterface(); }
        else if (action === 'auto') { state.auto = !state.auto; state.skipping = false; renderControls(); scheduleAuto(); }
        else if (action === 'skip') { state.skipping = !state.skipping; state.auto = false; renderControls(); scheduleAuto(); }
        else if (action === 'fullscreen') fullscreen();
      });
      dom.scene.addEventListener('click', function () { if (!state.panel) next(); });
      dom.backdrop.addEventListener('click', function (event) { if (event.target === dom.backdrop) closePanel(); });
      document.addEventListener('keydown', onKeydown);
      window.addEventListener('resize', noop);
      ensureSprites();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        if (state.panel) closePanel(); else if (state.hidden) { state.hidden = false; renderInterface(); } else openPanel('menu');
        return;
      }
      if (state.panel) {
        if (event.key === 'Tab') {
          var items = dom.modal.querySelectorAll('button:not(:disabled), input, [tabindex="0"]');
          if (!items.length) return;
          var first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dom.modal)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      if (event.target.closest && event.target.closest('button, input')) return;
      var key = event.key.toLowerCase();
      if (event.code === 'Space' || event.key === 'Enter' || event.key === 'ArrowRight') { event.preventDefault(); next(); }
      else if (key === 'h') { state.hidden = !state.hidden; renderInterface(); }
      else if (key === 'a') { state.auto = !state.auto; state.skipping = false; renderControls(); scheduleAuto(); }
      else if (key === 'l') openPanel('history');
      else if (event.key === 'ArrowLeft') prev();
    }

    function fullscreen() {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } catch (e) { notify('可使用浏览器的「添加到主屏幕」获得全屏体验'); }
    }

    /* ------------------------------------------------------------ 初始化 */
    function boot() {
      var storedSpeed = Number(read('speed', null));
      state.speed = Number.isFinite(storedSpeed) && storedSpeed > 0 ? Math.min(70, Math.max(5, storedSpeed)) : 32;
      var storedDelay = Number(read('delay', null));
      state.delay = Number.isFinite(storedDelay) && storedDelay > 0 ? Math.min(8, Math.max(1, storedDelay)) : 3;
      var storedVolume = Number(read('volume', null));
      state.volume = Number.isFinite(storedVolume) && storedVolume >= 0 ? Math.min(100, Math.max(0, storedVolume)) : 35;
      var storedMotion = read('motion', null);
      state.motion = storedMotion === null ? (P.theme.motion !== false) : !!storedMotion;
      var startAt = options.startIndex == null ? read('progress', 0) : options.startIndex;
      state.index = validIndex(startAt);
      state.furthest = Math.max(state.index, validIndex(read('furthest', 0)));
      state.saves = loadSaves();
      if (P.settings.titleScreen && !options.skipTitle && state.furthest === 0 && state.index === 0) state.panel = 'title';
      renderLine();
      renderControls();
      renderInterface();
      startTyping();
      emit('ready', { player: api });
    }

    /* ----------------------------------------------------------------- API */
    var api = {
      el: ui,
      on: function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); return api; },
      off: function (event, fn) { listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; }); return api; },
      goto: function (index) { closePanel(); state.hidden = false; goto(index); return api; },
      next: next,
      prev: prev,
      openPanel: openPanel,
      closePanel: closePanel,
      get index() { return state.index; },
      get panelOpen() { return !!state.panel; },
      get project() { return P; },
      setProject: function (project, opts) {
        opts = opts || {};
        var keep = opts.keepIndex === false ? 0 : state.index;
        var previousSignature = layersSignature;
        P = normalizeProject(project);
        copy = Object.assign({}, DEFAULT_COPY, (P.settings && P.settings.copy) || {});
        storeKey = 'gal-studio:' + (P.id || 'project') + ':';
        reindex();
        // 只有「章节/角色/素材」的结构真的变了才重建图层，纯改文字时保持立绘不闪
        layersSignature = computeLayersSignature(P);
        if (layersSignature !== previousSignature) {
          buildSceneLayers();
          ensureSprites();
        }
        state.index = Math.max(0, Math.min(P.lines.length - 1, keep));
        ui.setAttribute('data-theme', (P.theme && P.theme.preset) || 'backrooms');
        ui.setAttribute('data-grain', P.theme.grain === false ? '0' : '1');
        ui.setAttribute('data-dust', P.theme.dust === false ? '0' : '1');
        ui.setAttribute('data-veil', P.theme.veil === 'off' ? '0' : P.theme.veil === 'soft' ? 'soft' : '1');
        ui.setAttribute('data-align', P.theme.align === 'center' ? 'center' : 'left');
        ui.setAttribute('data-dialoglayout', P.theme.layout === 'wide' ? 'wide' : 'bottom');
        applyThemeVars();
        dom.brandTitle.textContent = P.title || '';
        dom.brandSub.textContent = P.subtitle || '';
        dom.sideNoteText.textContent = P.settings.sideNote || '';
        renderLine(); renderControls(); renderInterface();
        if (!opts.keepTyping) { state.chars = (P.lines[state.index] || {}).text ? P.lines[state.index].text.length : 0; paintText((P.lines[state.index] || {}).text || ''); }
        else startTyping();
        return api;
      },
      destroy: function () {
        destroyed = true;
        document.removeEventListener('keydown', onKeydown);
        if (typingTimer) clearInterval(typingTimer);
        if (autoTimer) clearTimeout(autoTimer);
        if (toastTimer) clearTimeout(toastTimer);
        ambience.close();
        if (audioEl) { audioEl.pause(); audioEl = null; }
        if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
        listeners = {};
      }
    };

    /* ------------------------------------------------------------- 启动 */
    reindex();
    build();
    layersSignature = computeLayersSignature(P);
    dom.brandTitle.textContent = P.title || '';
    dom.brandSub.textContent = P.subtitle || '';
    dom.sideNoteText.textContent = P.settings.sideNote || '';
    dom.sideNoteSub.textContent = P.settings.sideNoteSub || '';
    dom.connectionText.textContent = P.settings.connectionLabel || '与你相连';
    dom.progressLabel.textContent = P.settings.progressLabel || '';
    boot();
    return api;
  }

  /* 图层结构指纹：只有它变了才需要重建背景层与立绘 DOM */
  function computeLayersSignature(P) {
    var parts = [];
    P.chapters.forEach(function (chapter) { parts.push('c' + chapter.id + ':' + (chapter.backgroundId || '')); });
    P.characters.forEach(function (character_) {
      parts.push('p' + character_.id + ':' + (character_.slot || '') + ':' + (character_.expressions || []).map(function (expression) {
        var asset = expression.assetId ? P.assetMap[expression.assetId] : null;
        return [expression.id, expression.assetId, expression.keyOut, expression.keyColor, expression.tolerance, expression.edgeOnly, asset ? asset.src.length : 0].join('|');
      }).join(','));
    });
    return parts.join('#');
  }

  /* ------------------------------------------------------------ 数据规范化 */
  function normalizeProject(input) {
    var P = Object.assign({}, input || {});
    P.id = P.id || 'project';
    P.title = P.title || '未命名作品';
    P.subtitle = P.subtitle || '';
    P.author = P.author || '';
    P.tagline = P.tagline || '';
    P.description = P.description || '';
    P.theme = Object.assign({ preset: 'backrooms' }, P.theme || {});
    P.settings = Object.assign({
      saves: 6, titleScreen: false, sideNote: '', sideNoteSub: '',
      connectionLabel: '与你相连', progressLabel: '', endingTitle: '', endingEyebrow: '',
      endingText: '', endingThanks: '', endingFootnote: '', titleTagline: '', chaptersFootnote: ''
    }, P.settings || {});
    P.assets = Array.isArray(P.assets) ? P.assets : [];
    P.characters = Array.isArray(P.characters) ? P.characters.slice() : [];
    P.chapters = Array.isArray(P.chapters) ? P.chapters.slice() : [];
    P.lines = Array.isArray(P.lines) ? P.lines.slice() : [];
    P.assetMap = {};
    P.assets.forEach(function (a) { if (a && a.id) P.assetMap[a.id] = a; });
    P.characterMap = {};
    P.characters.forEach(function (c) { if (c && c.id) P.characterMap[c.id] = c; });
    if (!P.chapters.length) P.chapters.push({ id: 'ch-1', number: '01', title: '第一章', subtitle: '', description: '', level: '', location: '', backgroundId: '' });
    if (!P.lines.length) P.lines.push({ id: 'ln-1', chapterId: P.chapters[0].id, speakerId: null, text: '（在这里写下你的第一句台词）', expressionId: '', presentation: 'sprite', cgAssetId: '' });
    if (!P.characters.length) P.characters.push({ id: 'char-1', name: '主角', nameEn: '', slot: 'right', expressions: [] });
    P.cg = P.cg || '';
    return P;
  }

  /* ---------------------------------------------------------------- 导出 */
  function mount(selector, project, options) {
    var host = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!host) throw new Error('mount target not found');
    return createPlayer(host, project, options);
  }

  window.GalPlayer = {
    version: '1.0.0',
    createPlayer: createPlayer,
    mount: mount,
    keyOut: keyOut,
    icons: ICONS,
    normalizeProject: normalizeProject
  };

  /* 导出的单文件 HTML 里带有 #gal-project，自动引导 */
  function autoBoot() {
    var data = document.getElementById('gal-project');
    if (!data) return;
    try {
      var project = JSON.parse(data.textContent);
      var host = document.getElementById('gal-root') || document.body;
      window.__galPlayer = createPlayer(host, project, {});
    } catch (error) {
      if (window.console) console.error('[Galgame] 项目数据解析失败', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBoot);
  else autoBoot();
})();
