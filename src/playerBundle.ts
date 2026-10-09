/* 播放器资源打包：编辑器预览与导出产物共用同一份样式与运行时源码 */
import baseCss from './player/base.css?raw';
import themeCss from './player/theme.css?raw';
import runtimeSource from './player/runtime.js?raw';

export const PLAYER_CSS = `${baseCss}\n${themeCss}`;
export const PLAYER_JS = runtimeSource;

export interface GalPlayerApi {
  goto(index: number): void;
  next(): void;
  prev(): void;
  openPanel(panel: string): void;
  closePanel(): void;
  setProject(project: unknown, options?: { keepIndex?: boolean; keepTyping?: boolean }): void;
  destroy(): void;
  on(event: string, listener: (payload: { index?: number }) => void): unknown;
  readonly index: number;
  mount?: unknown;
  keyOut(src: string, keyColor: string, tolerance: number): Promise<string>;
}

export function getPlayerRuntime(): { createPlayer: (root: HTMLElement, project: unknown, options?: unknown) => GalPlayerApi; keyOut: GalPlayerApi['keyOut'] } | null {
  const runtime = (window as unknown as { GalPlayer?: { createPlayer: unknown; keyOut: unknown } }).GalPlayer;
  return (runtime as never) || null;
}
