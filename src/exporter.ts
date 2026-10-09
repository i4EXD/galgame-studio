/* ============================================================================
 * 导出：单文件 HTML（双击即玩 / 丢到任何静态托管都能跑）与项目文件
 * ========================================================================== */

import { PLAYER_CSS, PLAYER_JS } from './playerBundle';
import { deepClone, formatBytes, type Asset, type Project } from './types';

export interface ExportResult {
  filename: string;
  html: string;
  bytes: number;
  inlined: number;
  external: number;
  notes: string[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 把相对/绝对 URL 的素材抓成 dataURL，让导出文件真正自包含 */
async function inlineAssets(project: Project): Promise<{ project: Project; inlined: number; external: number; externalNames: string[] }> {
  const next = deepClone(project);
  let inlined = 0;
  const externalNames: string[] = [];
  next.assets = await Promise.all(next.assets.map(async (asset: Asset) => {
    if (!asset.src || asset.src.startsWith('data:')) return asset;
    try {
      const response = await fetch(asset.src);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      inlined += 1;
      return { ...asset, src: await blobToDataUrl(blob) };
    } catch {
      externalNames.push(asset.name);
      return asset;
    }
  }));
  return { project: next, inlined, external: externalNames.length, externalNames };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = src;
  });
}

function dataUrlBytes(src: string): number {
  const comma = src.indexOf(',');
  if (src.startsWith('data:') && comma > 0) return Math.round((src.length - comma - 1) * 0.75);
  return src.length;
}

/** 导出前把图片重编码成 WebP：让「发给朋友的 HTML」不至于几十兆 */
async function optimizeAssets(project: Project, quality = 0.9): Promise<{ project: Project; savedBytes: number; changed: number }> {
  let savedBytes = 0;
  let changed = 0;
  const next = deepClone(project);
  const supported = (() => {
    try {
      const probe = document.createElement('canvas');
      return probe.toDataURL('image/webp').startsWith('data:image/webp');
    } catch { return false; }
  })();
  if (!supported) return { project: next, savedBytes: 0, changed: 0 };

  for (const asset of next.assets) {
    if (asset.kind === 'audio' || !asset.src) continue;
    try {
      const image = await loadImage(asset.src);
      const before = dataUrlBytes(asset.src);
      if (before < 90 * 1024) continue;                       // 小图不值得折腾
      const maxSize = asset.kind === 'sprite' ? 1400 : 1920;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL('image/webp', quality);
      const after = dataUrlBytes(encoded);
      if (after > 0 && after < before * 0.92) {
        asset.src = encoded;
        asset.bytes = after;
        savedBytes += before - after;
        changed += 1;
      }
    } catch { /* 跨域或损坏的图：保持原样 */ }
  }
  return { project: next, savedBytes, changed };
}

function escapeForScript(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
}

export interface ExportOptions {
  webFonts?: boolean;
  inlineAssets?: boolean;
  /** 导出前把图片重编码为 WebP（体积可小一个数量级） */
  optimize?: boolean;
}

export async function buildStandaloneHtml(project: Project, options: ExportOptions = {}): Promise<ExportResult> {
  const notes: string[] = [];
  let source = deepClone(project);
  let inlined = 0;
  let external = 0;
  // 先把外部素材抓进来（此时才有真实体积可比较），再统一压缩
  if (options.inlineAssets !== false) {
    const result = await inlineAssets(source);
    source = result.project;
    inlined = result.inlined;
    external = result.external;
    if (external) notes.push(`有 ${external} 个素材是外部文件、无法内联（${result.externalNames.slice(0, 3).join('、')}${external > 3 ? ' 等' : ''}）。把导出的 HTML 与它们放在同一目录即可正常显示，或先在「素材」里重新上传这些图。`);
  }
  if (options.optimize !== false) {
    const optimized = await optimizeAssets(source);
    source = optimized.project;
    if (optimized.changed) notes.push(`已自动把 ${optimized.changed} 张图片重编码为 WebP，省下约 ${formatBytes(optimized.savedBytes)}。`);
  }
  const data = escapeForScript(JSON.stringify(source));
  const css = PLAYER_CSS.replace(/<\/style/gi, '<\\/style');
  const js = PLAYER_JS.replace(/<\/script/gi, '<\\/script');
  const fontLink = options.webFonts === false
    ? ''
    : `\n  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">`;
  const html = `<!doctype html>
<html lang="zh-CN" class="gal-embed">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="${source.theme.preset === 'paper' ? '#efe7d8' : '#171b14'}">
  <meta name="description" content="${(source.description || source.tagline || source.title).replace(/"/g, '&quot;')}">
  <title>${source.title.replace(/</g, '&lt;')}</title>${fontLink}
  <style>${css}</style>
</head>
<body>
  <div id="gal-root"></div>
  <script id="gal-project" type="application/json">${data}</script>
  <script>${js}</script>
</body>
</html>
`;
  return {
    filename: `${safeName(source.title)}.html`,
    html,
    bytes: new Blob([html]).size,
    inlined,
    external,
    notes,
  };
}

export function buildProjectFile(project: Project): { filename: string; content: string } {
  return {
    filename: `${safeName(project.title)}.galproj.json`,
    content: JSON.stringify({ ...project, version: 1, exportedAt: new Date().toISOString() }, null, 0),
  };
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob.size;
}

export function safeName(title: string): string {
  return (title || '未命名作品').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || '未命名作品';
}

export function describeExport(result: ExportResult): string {
  return `${result.filename} · ${formatBytes(result.bytes)}${result.inlined ? ` · 已内联 ${result.inlined} 个素材` : ''}`;
}
