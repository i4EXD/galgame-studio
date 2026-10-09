/* 自动化脚本：走进游戏，验证播放器在 file:// 下的完整交互 */
(function () {
  var params = new URLSearchParams(location.search);
  var steps = (params.get('steps') || 'start').split(',');
  function waitFor(selector, fn, tries) {
    tries = tries == null ? 300 : tries;
    var node = document.querySelector(selector);
    if (node) { fn(node); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitFor(selector, fn, tries - 1); }, 80);
  }
  var delay = 900;
  steps.forEach(function (step) {
    setTimeout(function () {
      if (step === 'start') waitFor('[data-action="start"]', function (n) { n.click(); });
      else if (step === 'next') waitFor('[data-action="next"]', function (n) { n.click(); });
      else if (step === 'save') waitFor('[data-action="save"]', function (n) { n.click(); });
      else if (step === 'history') waitFor('[data-action="history"]', function (n) { n.click(); });
      else if (step === 'settings') waitFor('[data-action="settings"]', function (n) { n.click(); });
      else if (step === 'chapters') waitFor('[data-action="chapters"]', function (n) { n.click(); });
      else if (step === 'menu') waitFor('[data-action="menu"]', function (n) { n.click(); });
      else if (step === 'sound') waitFor('[data-action="sound"]', function (n) { n.click(); });
      else if (step === 'auto') waitFor('[data-action="auto"]', function (n) { n.click(); });
      else if (step === 'jump') waitFor('.modal-chapters .chapter-card:nth-child(2)', function (n) { n.click(); });
    }, delay);
    delay += 900;
  });
})();
