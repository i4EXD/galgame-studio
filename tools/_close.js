/* 验证脚本：关掉新手引导并选中第 3 句台词。
   用 requestAnimationFrame 而不是 setTimeout —— headless 的虚拟时间会把定时器一次性跑完，
   而 rAF 会跟着渲染帧走，只要 React 渲染出来就一定能点到。 */
(function () {
  var closed = 0;
  function closeTick() {
    var button = document.querySelector('.gs-modal-backdrop .gs-icon-btn');
    if (button) { button.click(); closed += 1; }
    if (closed < 3) requestAnimationFrame(closeTick);
  }
  requestAnimationFrame(closeTick);

  var picked = false;
  function pickTick() {
    if (!picked && !document.querySelector('.gs-modal-backdrop')) {
      var lines = document.querySelectorAll('.gs-line');
      if (lines.length > 2) { lines[2].click(); picked = true; }
    }
    if (!picked) requestAnimationFrame(pickTick);
  }
  requestAnimationFrame(pickTick);
})();
