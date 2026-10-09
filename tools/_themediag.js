/* 主题诊断：显示 CSS 变量的实际取值与关键元素的计算样式 */
(function () {
  setTimeout(function () {
    var root = document.documentElement;
    var read = function (name) { return name + ': ' + (getComputedStyle(root).getPropertyValue(name).trim() || '(空)'); };
    var modal = document.querySelector('.modal');
    var lines = [
      'data-theme: ' + document.querySelector('.game').getAttribute('data-theme'),
      read('--gal-frame-a'),
      read('--gal-frame-b'),
      read('--gal-ink'),
      read('--gal-accent'),
      read('--gal-radius'),
      'modal bg: ' + (modal ? getComputedStyle(modal).backgroundImage.slice(0, 120) : 'n/a'),
      'modal color: ' + (modal ? getComputedStyle(modal).color : 'n/a'),
    ];
    var box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;margin:0;padding:10px 12px;background:rgba(0,0,0,.88);color:#8f8;font:12px/1.6 Consolas,monospace;white-space:pre-wrap';
    box.textContent = lines.join('\n');
    document.body.appendChild(box);
  }, 2600);
})();
