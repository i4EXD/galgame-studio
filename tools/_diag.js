/* 布局诊断：把关键元素的几何信息显示在页面上 */
(function () {
  setTimeout(function () {
    function rect(node) {
      var r = node.getBoundingClientRect();
      return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    }
    var lines = [];
    var bar = document.querySelector('.topbar');
    lines.push('.topbar ' + rect(bar));
    lines.push('.brand ' + rect(document.querySelector('.brand')));
    Array.prototype.forEach.call(document.querySelector('.top-actions').children, function (node) {
      lines.push('  > ' + (node.className || node.tagName) + ' ' + rect(node));
    });
    lines.push('.chapter-intro ' + rect(document.querySelector('.chapter-intro')));
    lines.push('.dialogue-box ' + rect(document.querySelector('.dialogue-box')));
    lines.push('.character-stage ' + rect(document.querySelector('.character-stage')));
    lines.push('.side-note ' + rect(document.querySelector('.side-note')));
    lines.push('.scene-caption ' + rect(document.querySelector('.scene-caption')));

    var box = document.createElement('pre');
    box.id = 'diag';
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;margin:0;padding:10px 12px;background:rgba(0,0,0,.88);color:#8f8;font:12px/1.6 Consolas,monospace;white-space:pre-wrap';
    box.textContent = lines.join('\n');
    document.body.appendChild(box);
  }, 2600);
})();
