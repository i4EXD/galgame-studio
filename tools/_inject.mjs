/* 往一个 HTML 末尾注入一段脚本（用于自动化验证导出产物）
   用法: node _inject.mjs <srcHtml> <outHtml> <jsFile> */
import fs from 'node:fs';

const [src, out, jsFile] = process.argv.slice(2);
const html = fs.readFileSync(src, 'utf8');
const js = fs.readFileSync(jsFile, 'utf8');
const at = html.lastIndexOf('</body>');
const patched = `${html.slice(0, at)}<script>\n${js}\n</script>\n${html.slice(at)}`;
fs.writeFileSync(out, patched);
console.log(`injected -> ${out} (${patched.length} bytes)`);
