/* 端到端交互验证（桌面版 + 移动版通用）：
   用注入脚本模拟真实操作，最后把关键状态画在页面顶部，截图即可判读。
   用法：node tools/_inject.mjs dist/index.html _final/e2e.html tools/_e2e.js
        URL 上用 ?steps=close,select:2,edittext,report 控制流程 */
(function () {
  var params = new URLSearchParams(location.search);
  var steps = (params.get('steps') || 'close,report').split(',').filter(Boolean);
  var log = [];

  function isMobileUi() { return !!document.querySelector('.gm-app'); }
  function q(selector) { return document.querySelector(selector); }
  function qa(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  // headless 的虚拟时间下 rAF 不一定持续触发，rAF + setTimeout 双保险
  function frame() {
    return new Promise(function (resolve) {
      var settled = false;
      function finish() { if (!settled) { settled = true; resolve(); } }
      requestAnimationFrame(finish);
      setTimeout(finish, 16);
    });
  }
  function sleep(frames) {
    var chain = Promise.resolve();
    for (var i = 0; i < (frames || 3); i++) chain = chain.then(frame);
    return chain;
  }
  async function until(label, fn, tries) {
    tries = tries || 900;
    for (var i = 0; i < tries; i++) {
      var value = fn();
      if (value) return value;
      await frame();
    }
    log.push('超时: ' + label);
    return null;
  }
  function byText(selector, text) {
    return qa(selector).filter(function (node) { return node.textContent.indexOf(text) >= 0; })[0];
  }
  function clickButtonWithTitle(prefix) {
    return qa('button').filter(function (b) { return (b.title || '').indexOf(prefix) === 0; })[0];
  }

  function counts() {
    var stat = {};
    stat.foot = qa('.gs-foot-item').map(function (n) { return n.textContent.trim(); }).join(' / ');
    stat.assets = qa('.gs-asset').length;
    stat.lines = qa('.gs-line').length;
    stat.chapters = Math.max(0, qa('.gs-chapterchip').length - 1);
    stat.characters = qa('.gs-card').length;
    stat.fatal = q('#gs-fatal') ? q('#gs-fatal').textContent.trim().slice(0, 200) : '(无错误)';
    var title = q('.gm-title b') || q('.gs-title-button');
    stat.title = title ? title.textContent.trim() : '(未读到标题)';
    var undo = isMobileUi() ? q('.gm-undo button[aria-label="撤销"]') : clickButtonWithTitle('撤销');
    var redo = isMobileUi() ? q('.gm-undo button[aria-label="重做"]') : clickButtonWithTitle('重做');
    stat.undo = undo ? (undo.disabled ? '不可用' : '可撤销') : '找不到按钮';
    stat.redo = redo ? (redo.disabled ? '不可用' : '可重做') : '找不到按钮';
    var internal = window.__galStore ? window.__galStore.getState() : null;
    stat.history = internal
      ? (internal.history.length + ' 条 [' + internal.history.map(function (h) { return h.label; }).slice(-3).join(' / ') + ']')
      : '(取不到 store)';
    if (isMobileUi()) {
      var vw = document.documentElement.clientWidth;
      stat.viewport = '视口宽 ' + vw + ' / body ' + Math.round(document.body.getBoundingClientRect().width);
      stat.wide = Array.prototype.slice.call(document.querySelectorAll('.gm-app *'))
        .filter(function (el) { return el.getBoundingClientRect().width > vw + 1; })
        .slice(0, 6)
        .map(function (el) { return (el.className || el.tagName) + '(' + Math.round(el.getBoundingClientRect().width) + ')'; })
        .join(' , ') || '(没有超宽元素)';
      stat.topbar = qa('.gm-top button').map(function (b) {
        var r = b.getBoundingClientRect();
        return (b.getAttribute('aria-label') || b.className.split(' ')[0]) + '@' + Math.round(r.left) + 'w' + Math.round(r.width);
      }).join(' ');
    }
    var toast = q('.gs-toast');
    stat.toast = toast ? toast.textContent.trim() : '(无)';
    var sheet = q('.gm-sheet');
    stat.sheet = sheet ? (q('.gm-sheet-head strong') || {}).textContent || '已打开' : '(未打开)';
    stat.modal = q('.gs-modal-backdrop') ? '有弹窗(' + (q('.gs-modal-head h2') || {}).textContent + ')' : '无弹窗';
    var frameNode = (q('.gm-fullscreen iframe') || q('.gs-preview-frame iframe'));
    var inner = frameNode && frameNode.contentDocument ? frameNode.contentDocument.querySelector('.game') : null;
    stat.preview = inner ? (inner.className || '有 .game') : '预览未就绪';
    var speaker = inner ? inner.querySelector('.speaker-name') : null;
    var text = inner ? inner.querySelector('.dialogue-text') : null;
    stat.line = speaker && text ? (speaker.textContent + '：' + (text.textContent || '').slice(0, 16)) : '(无)';
    return stat;
  }

  function makeSpriteFile(name) {
    var canvas = document.createElement('canvas');
    canvas.width = 420; canvas.height = 620;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7cc4ff';
    ctx.beginPath();
    ctx.arc(210, 190, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(150, 280, 120, 300);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(new File([blob], name || 'e2e-sprite.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }

  async function switchView(view) {
    var index = { script: 0, chapters: 1, cast: 2, assets: 3, theme: 4, publish: 5 }[view] || 0;
    var tabs = qa(isMobileUi() ? '.gm-tab' : '.gs-view');
    if (tabs[index]) tabs[index].click();
    await sleep(5);
  }

  async function runStep(step) {
    var parts = step.split(':');
    var action = parts[0];
    var arg = parts[1];

    if (action === 'close') {
      // 首屏弹窗要等 boot 完成（读本地项目 + 载入模板）才会出现，不能一上来就点
      await until('引导弹窗', function () { return q('.gs-modal-backdrop'); }, 300);
      for (var i = 0; i < 5 && q('.gs-modal-backdrop'); i++) {
        var button = q('.gs-modal-backdrop .gs-icon-btn');
        if (button) button.click();
        await sleep(4);
        if (q('.gs-modal-backdrop')) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(4);
        }
      }
      log.push(q('.gs-modal-backdrop') ? '关闭失败：弹窗还在' : '关闭引导弹窗');
      return;
    }

    if (action === 'template') {
      var label = { demo: '示例作品', starter: '教学项目', blank: '完全空白' }[arg] || '教学项目';
      if (isMobileUi()) {
        (await until('更多按钮', function () { return q('.gm-icon[aria-label="更多"]'); }))?.click();
        (await until('模板菜单项', function () { return byText('.gm-menuitem', '模板'); }))?.click();
      } else {
        (await until('模板按钮', function () { return byText('.gs-topactions .gs-btn', '模板'); }))?.click();
      }
      var option = await until('模板选项', function () {
        return byText('.gm-menuitem', label) || qa('.gs-template')[({ demo: 0, starter: 1, blank: 2 }[arg] || 1)];
      });
      if (option) option.click();
      await sleep(8);
      log.push('已切模板 → ' + label);
      return;
    }

    if (action === 'upload') {
      await switchView(arg === 'sprite' ? 'cast' : 'assets');
      var input = await until('上传输入框', function () { return q('.gm-body input[type=file]') || q('.gs-col-left input[type=file]'); });
      if (!input) return;
      // 包一层，记录真实调用序列（store 是单例，组件内部用的是同一个对象）
      var stx = window.__galStore;
      var trace = [];
      if (stx && !stx.__traced) {
        stx.__traced = true;
        var origUpdate = stx.update.bind(stx);
        var origBatch = stx.batch.bind(stx);
        stx.update = function (fn2, label, opts) { trace.push('update:' + label + '(skip=' + (stx.batching != null) + ')'); return origUpdate(fn2, label, opts); };
        stx.batch = function (label, fn) { trace.push('batch:' + label + '(already=' + (stx.batching != null) + ')'); return origBatch(label, fn); };
        window.__galTrace = trace;
      } else if (stx) {
        trace = window.__galTrace;
      }
      var file = await makeSpriteFile('e2e-sprite.png');
      var transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(30);
      log.push('已模拟上传 ' + file.name + '（' + Math.round(file.size / 1024) + 'KB）');
      log.push('调用序列: ' + (window.__galTrace || []).join(' → '));
      if (window.__galTrace) window.__galTrace.length = 0;
      return;
    }

    if (action === 'undo' || action === 'redo') {
      var target = isMobileUi()
        ? await until(action + '按钮', function () { return q('.gm-undo button[aria-label="' + (action === 'undo' ? '撤销' : '重做') + '"]'); })
        : await until(action + '按钮', function () { return clickButtonWithTitle(action === 'undo' ? '撤销' : '重做'); });
      if (!target) return;
      var before = target.disabled;
      target.click();
      await sleep(10);
      log.push((action === 'undo' ? '撤销' : '重做') + '前 disabled=' + before
        + '，之后 toast=' + ((q('.gs-toast') || {}).textContent || '无'));
      return;
    }

    if (action === 'view') { await switchView(arg); log.push('切到视图 ' + arg); return; }

    if (action === 'select') {
      var node = await until('台词行', function () { return qa('.gs-line')[Number(arg || 0)]; });
      if (node) node.click();
      await sleep(6);
      log.push('选中第 ' + (Number(arg || 0) + 1) + ' 句');
      return;
    }

    if (action === 'sheet') {
      (await until('底部把手', function () { return q('.gm-handle:not(.is-idle)'); }))?.click();
      await sleep(8);
      log.push('打开底部编辑抽屉');
      return;
    }

    if (action === 'preview') {
      (await until('预览按钮', function () {
        return q('.gm-icon[aria-label="预览"]') || byText('.gs-topactions .gs-btn', '预览');
      }))?.click();
      await until('全屏预览', function () { return q('.gm-fullscreen') || q('.gs-preview.is-fullscreen'); });
      await sleep(14);
      log.push('打开全屏预览');
      return;
    }

    if (action === 'edittext') {
      var area = await until('台词输入框', function () {
        return q('.gm-sheet textarea') || q('.gs-col-right textarea') || q('textarea');
      });
      if (!area) return;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(area, '【E2E 改写验证】这句话是脚本改的。');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(12);
      log.push('已改写台词文本');
      return;
    }

    if (action === 'batchtest') {
      var s = window.__galStore;
      if (!s) { log.push('batchtest: 取不到 store'); return; }
      var before = s.getState().history.length;
      s.batch('测试事务', function () {
        s.addCharacter();
        s.addChapter();
      });
      var mid = s.getState();
      log.push('batch 测试: history ' + before + ' → ' + mid.history.length
        + '，角色 ' + mid.project.characters.length + '，章节 ' + mid.project.chapters.length);
      return;
    }

    if (action === 'uploadtrace') {
      var st = window.__galStore;
      if (!st) { log.push('uploadtrace: 取不到 store'); return; }
      var beforeCount = st.getState().history.length;
      var asset = { id: 'trace-asset-1', name: 'trace', kind: 'sprite', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' };
      var charId = st.getState().project.characters[0].id;
      st.batch('复刻导入 1 张立绘', function () {
        st.addAssets([asset], false);
        st.addExpression(charId, asset.id, asset.name, false);
      });
      var state2 = st.getState();
      log.push('复刻 upload: history ' + beforeCount + ' → ' + state2.history.length
        + '，素材 ' + state2.project.assets.length
        + '，表情 ' + state2.project.characters[0].expressions.length
        + '，最近历史=' + (state2.history[state2.history.length - 1] || {}).label);
      return;
    }

    if (action === 'report') {
      await sleep(6);
      var stat = counts();
      var lines = log.concat([
        '界面: ' + (isMobileUi() ? '移动版' : '桌面版'),
        stat.topbar ? ('顶栏按钮: ' + stat.topbar) : '',
        stat.viewport ? ('视口: ' + stat.viewport) : '',
        stat.wide ? ('超宽元素: ' + stat.wide) : '',
        '标题: ' + stat.title,
        '底部统计: ' + stat.foot,
        '可见台词行: ' + stat.lines + ' / 章节: ' + stat.chapters + ' / 角色: ' + stat.characters + ' / 素材卡片: ' + stat.assets,
        '撤销: ' + stat.undo + ' / 重做: ' + stat.redo,
        '历史栈: ' + stat.history,
        '底部抽屉: ' + stat.sheet,
        '弹窗状态: ' + stat.modal,
        '最后提示: ' + stat.toast,
        '预览: ' + stat.preview,
        '预览当前句: ' + stat.line,
        '页面错误: ' + stat.fatal,
      ]);
      var box = document.createElement('pre');
      box.id = 'e2e-report';
      var atBottom = params.get('report') === 'bottom';
      box.style.cssText = 'position:fixed;left:0;right:0;z-index:99999;margin:0;padding:10px 14px;'
        + (atBottom ? 'bottom:0;' : 'top:0;')
        + 'background:rgba(0,0,0,.9);color:#9f9;font:12px/1.6 Consolas,monospace;white-space:pre-wrap;max-height:60dvh;overflow:auto';
      box.textContent = lines.join('\n');
      document.body.appendChild(box);
      console.log(lines.join('\n'));
      return;
    }
  }

  (async function () {
    for (var i = 0; i < steps.length; i++) {
      try { await runStep(steps[i]); }
      catch (error) { log.push('步骤 ' + steps[i] + ' 失败: ' + error.message); }
    }
  })();
})();
