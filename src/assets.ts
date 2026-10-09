/* ============================================================================
 * 素材导入：读文件 → 按用途压缩 → 转成 dataURL（项目自包含，导出即单文件）
 * ========================================================================== */

import { uid, type Asset, type AssetKind } from './types';

export interface ImportOptions {
  kind: AssetKind;
  maxSize?: number;
  quality?: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch { /* 回退 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片无法读取'));
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

function hasAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) return true;
  return false;
}

/** 把一张图片按用途压缩成 dataURL */
export async function compressImage(file: File, options: ImportOptions): Promise<{ src: string; width: number; height: number; bytes: number }> {
  const isSprite = options.kind === 'sprite';
  const maxSize = options.maxSize || (isSprite ? 1400 : 1920);
  const bitmap = await loadBitmap(file);
  const sourceWidth = 'width' in bitmap ? bitmap.width : 0;
  const sourceHeight = 'height' in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth || 1, sourceHeight || 1));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器不支持画布处理');
  context.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  let transparent = false;
  try {
    const pixels = context.getImageData(0, 0, width, height);
    transparent = hasAlpha(pixels.data);
  } catch { /* 跨域图不可读，按不透明处理 */ }

  // 立绘 / 带透明的图保留 PNG（抠图需要原色），照片类转 JPEG 体积更小
  const usePng = transparent || (isSprite && file.type === 'image/png' && file.size < 900 * 1024);
  const src = usePng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', options.quality || (isSprite ? 0.92 : 0.86));
  return { src, width, height, bytes: Math.round((src.length - src.indexOf(',') - 1) * 0.75) };
}

export async function fileToAsset(file: File, kind: AssetKind): Promise<Asset> {
  const baseName = file.name.replace(/\.[a-z0-9]+$/i, '') || '素材';
  if (kind === 'audio') {
    const src = await readAsDataUrl(file);
    return { id: uid('as'), name: file.name, kind, src, bytes: file.size };
  }
  if (!/^image\//.test(file.type)) throw new Error(`「${file.name}」不是图片`);
  const { src, width, height, bytes } = await compressImage(file, { kind });
  return { id: uid('as'), name: baseName, kind, src, width, height, bytes };
}

export async function importFiles(files: File[], kindHint?: AssetKind): Promise<Asset[]> {
  const result: Asset[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const kind = kindHint || guessKind(file);
    try {
      result.push(await fileToAsset(file, kind));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (!result.length && errors.length) throw new Error(errors[0]);
  return result;
}

export function guessKind(file: File): AssetKind {
  if (/^audio\//.test(file.type)) return 'audio';
  const name = file.name.toLowerCase();
  if (/cg|event|事件/.test(name)) return 'cg';
  if (/bg|back|背景|scene/.test(name)) return 'background';
  if (/sp|char|立绘|stand/.test(name)) return 'sprite';
  return 'sprite';
}

export function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });
}

/** 用播放器运行时的抠图算法做一张预览图 */
export async function keyOutPreview(src: string, keyColor: string, tolerance: number, edgeOnly = false): Promise<string> {
  const runtime = (window as unknown as { GalPlayer?: { keyOut: (s: string, c: string, t: number, e?: boolean) => Promise<string> } }).GalPlayer;
  if (!runtime) return src;
  try { return await runtime.keyOut(src, keyColor, tolerance, edgeOnly); } catch { return src; }
}
