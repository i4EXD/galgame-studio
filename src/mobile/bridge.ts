/* ============================================================================
 * 原生桥：Android 壳注入 window.GalBridge；浏览器里变成「下载文件」的降级实现。
 * 文件内容分块传输（每块 192KB base64），避免几 MB 的字符串一次性过桥卡死。
 * ========================================================================== */

export interface GalBookEntry {
  id: string;
  name: string;
  bytes: number;
  savedAt: number;
}

export interface GalBridgeApi {
  isAndroid?: boolean;
  saveTextFile?(name: string, base64: string, mime: string): string;
  beginSaveFile?(name: string, mime: string): string;
  appendChunk?(base64: string): string;
  endSaveFile?(): string;
  listBooks?(): string;
  bookUrl?(id: string): string;
  deleteBook?(id: string): string;
  toast?(message: string): void;
  share?(name: string, mime: string): void;
}

export function nativeBridge(): GalBridgeApi | null {
  const bridge = (window as unknown as { GalBridge?: GalBridgeApi }).GalBridge;
  return bridge && bridge.isAndroid ? bridge : null;
}

export function isNativeApp(): boolean {
  return nativeBridge() !== null;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)) as number[]);
  }
  return btoa(binary);
}

export function base64FromBlob(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then(buffer => base64FromBytes(new Uint8Array(buffer)));
}

const CHUNK = 192 * 1024;

export interface SaveResult {
  ok: boolean;
  message: string;
  path?: string;
  /** 保存到了 App 内部书架（可以直接在应用里阅读） */
  shelved?: boolean;
}

/**
 * 保存一个文本文件（导出 HTML / 项目 JSON）。
 * Android：分块传给原生，写到「下载/GalgameStudio」并同时进书架；浏览器：走 <a download>。
 */
export async function saveTextFile(filename: string, content: string, mime = 'text/plain'): Promise<SaveResult> {
  const bridge = nativeBridge();
  if (bridge?.beginSaveFile && bridge.appendChunk && bridge.endSaveFile) {
    try {
      const base64 = base64FromBytes(new TextEncoder().encode(content));
      bridge.beginSaveFile(filename, mime);
      for (let i = 0; i < base64.length; i += CHUNK) {
        bridge.appendChunk(base64.slice(i, i + CHUNK));
      }
      const path = bridge.endSaveFile();
      return { ok: true, message: `已保存到 ${path}`, path, shelved: true };
    } catch (error) {
      return { ok: false, message: `保存失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }
  // 浏览器环境
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: true, message: `已下载 ${filename}（${(blob.size / 1024 / 1024).toFixed(2)} MB）` };
}

/** 读取一个本地文件（打开项目文件用）：返回文本内容 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** 触发系统选择器打开文件（原生 WebView 里由 onShowFileChooser 接管） */
export function pickFile(accept: string, onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (file) onPick(file);
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

/** 书架：App 内部保存过的作品 */
export function listBooks(): GalBookEntry[] {
  const bridge = nativeBridge();
  if (!bridge?.listBooks) return [];
  try {
    const raw = bridge.listBooks();
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function bookUrl(id: string): string {
  const bridge = nativeBridge();
  return bridge?.bookUrl ? bridge.bookUrl(id) : '';
}

export function deleteBook(id: string) {
  nativeBridge()?.deleteBook?.(id);
}

export function nativeToast(message: string) {
  const bridge = nativeBridge();
  if (bridge?.toast) bridge.toast(message);
}
