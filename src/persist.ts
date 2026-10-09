/* ============================================================================
 * 持久化：优先 IndexedDB（可存大项目），不可用时退回 localStorage / 内存。
 * ========================================================================== */

const DB_NAME = 'galgame-studio';
const STORE = 'projects';
const LS_KEY = 'galgame-studio:project';
const LS_META = 'galgame-studio:meta';

export interface StorageInfo {
  mode: 'indexeddb' | 'localstorage' | 'memory';
  note: string;
}

let info: StorageInfo | null = null;
let memory: unknown = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('indexeddb blocked'));
    } catch (error) {
      reject(error);
    }
  });
}

/** 某些环境（隐私模式 / 无痕 / file://）里 IndexedDB 会一直不返回，必须兜底 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function storageInfo(): StorageInfo {
  if (info) return info;
  const hasIdb = typeof indexedDB !== 'undefined' && location.protocol !== 'file:';
  info = hasIdb
    ? { mode: 'indexeddb', note: '自动保存到浏览器（IndexedDB）' }
    : { mode: 'localstorage', note: '自动保存到浏览器（本地存储）' };
  return info;
}

export interface LoadedProject {
  project: unknown | null;
  /** true = 上次只保存下了文字（项目超出 localStorage 容量，素材没能留下） */
  slim: boolean;
}

export async function loadProject(): Promise<LoadedProject> {
  const mode = storageInfo().mode;
  if (mode === 'indexeddb') {
    try {
      const db = await withTimeout(openDb(), 2500, 'indexeddb open');
      const value = await withTimeout(new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get('current');
        tx.onsuccess = () => resolve(tx.result);
        tx.onerror = () => reject(tx.error);
      }), 2500, 'indexeddb get');
      db.close();
      if (value) return { project: value, slim: false };
    } catch { /* 落到下面的兜底 */ }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { project: parsed, slim: Boolean(parsed && parsed.__slim) };
    }
  } catch { /* 忽略 */ }
  return { project: memory, slim: false };
}

export async function saveProject(project: unknown): Promise<StorageInfo> {
  const mode = storageInfo().mode;
  if (mode === 'indexeddb') {
    try {
      const db = await withTimeout(openDb(), 2500, 'indexeddb open');
      await withTimeout(new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(project, 'current');
        tx.onsuccess = () => resolve();
        tx.onerror = () => reject(tx.error);
      }), 4000, 'indexeddb put');
      db.close();
      persistMeta();
      return storageInfo();
    } catch { /* 落到下面的兜底 */ }
  }
  try {
    const raw = JSON.stringify(project);
    if (raw.length < 4_500_000) {
      localStorage.setItem(LS_KEY, raw);
      persistMeta();
      return storageInfo();
    }
    // 太大：只存一份「瘦身版」（去掉素材数据），素材由用户自己保存项目文件
    const slim = JSON.parse(raw);
    slim.assets = (slim.assets || []).map((a: { src?: string }) => ({ ...a, src: '' }));
    slim.__slim = true;
    localStorage.setItem(LS_KEY, JSON.stringify(slim));
    persistMeta();
    return { mode: 'localstorage', note: '项目较大，仅保存了文字部分；素材请在「发布」里导出项目文件' };
  } catch {
    memory = project;
    return { mode: 'memory', note: '浏览器不允许自动保存，请用「保存项目文件」手动备份' };
  }
}

export function lastSavedAt(): number | null {
  try {
    const raw = localStorage.getItem(LS_META);
    return raw ? JSON.parse(raw).at : null;
  } catch { return null; }
}

function persistMeta() {
  try { localStorage.setItem(LS_META, JSON.stringify({ at: Date.now() })); } catch { /* 忽略 */ }
}

export async function clearProject(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).delete('current');
      tx.onsuccess = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch { /* 忽略 */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* 忽略 */ }
  memory = null;
}
