/* 预览：真正的播放器运行时跑在同源 iframe 里，所见即所得 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PLAYER_CSS, PLAYER_JS, type GalPlayerApi } from './playerBundle';
import type { Project } from './types';
import { Btn, Icon } from './ui';

export type Device = 'desktop' | 'mobile';

export function Preview(props: {
  project: Project;
  index: number;
  syncKey: number;
  device: Device;
  onDeviceChange: (device: Device) => void;
  onIndexChange: (index: number) => void;
  onReady?: () => void;
}) {
  const { project, index, syncKey, device, onIndexChange } = props;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<GalPlayerApi | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const srcDoc = useMemo(() => `<!doctype html>
<html lang="zh-CN" class="gal-embed">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>${PLAYER_CSS.replace(/<\/style/gi, '<\\/style')}</style></head>
<body><div id="gal-root"></div>
<script>${PLAYER_JS.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`, []);

  // 初始化播放器
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    let attempts = 0;
    setStatus('loading');
    let timer = 0;
    const start = () => {
      if (cancelled) return;
      attempts += 1;
      const runtime = (frame.contentWindow as unknown as { GalPlayer?: { createPlayer: (root: HTMLElement, project: unknown, options?: unknown) => GalPlayerApi } } | null)?.GalPlayer;
      const host = frame.contentDocument?.getElementById('gal-root') as HTMLElement | null | undefined;
      if (!runtime || !host) {
        if (attempts < 80) timer = window.setTimeout(start, 60);
        else setStatus('error');
        return;
      }
      playerRef.current?.destroy();
      playerRef.current = runtime.createPlayer(host, project, { transient: true, skipTitle: true, startIndex: index });
      playerRef.current.on('index', (payload) => { if (typeof payload.index === 'number') onIndexChange(payload.index); });
      // 暴露给宿主页面：Android 返回键需要问播放器「现在有弹窗吗」
      (frame.contentWindow as unknown as { __galPlayer?: GalPlayerApi }).__galPlayer = playerRef.current;
      setStatus('ready');
      props.onReady?.();
    };
    timer = window.setTimeout(start, 20);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // 仅在 iframe 重建时重新初始化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  // 项目内容变化 → 热更新（不重建 iframe，保留打字机与立绘缓存）
  useEffect(() => {
    if (status !== 'ready') return;
    try { playerRef.current?.setProject(project, { keepIndex: true, keepTyping: true }); } catch { /* 忽略 */ }
  }, [project, status]);

  // 编辑器选中某句 → 播放器跳转
  useEffect(() => {
    if (status !== 'ready') return;
    try { playerRef.current?.goto(index); } catch { /* 忽略 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, status]);

  useEffect(() => () => { playerRef.current?.destroy(); playerRef.current = null; }, []);

  return (
    <div className={`gs-preview is-${device} ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="gs-preview-bar">
        <span className="gs-preview-title"><Icon name="film" size={14} />实时预览<em>{status === 'ready' ? '所见即所得' : status === 'loading' ? '正在启动引擎…' : '引擎启动失败'}</em></span>
        <div className="gs-preview-tools">
          <Btn size="sm" icon="refresh" kind="quiet" title="重新加载预览" onClick={() => setReloadToken(value => value + 1)} />
          <span className="gs-seg">
            <button className={device === 'desktop' ? 'is-on' : ''} onClick={() => props.onDeviceChange('desktop')} title="桌面比例">16:9</button>
            <button className={device === 'mobile' ? 'is-on' : ''} onClick={() => props.onDeviceChange('mobile')} title="手机比例">9:16</button>
          </span>
          <Btn size="sm" icon="expand" kind="quiet" title="全屏预览" onClick={() => setFullscreen(value => !value)} />
        </div>
      </div>
      <div className="gs-preview-stage">
        <div className="gs-preview-frame">
          <iframe ref={frameRef} srcDoc={srcDoc} title="galgame 预览" allow="autoplay; fullscreen" />
        </div>
      </div>
      {fullscreen && <div className="gs-preview-veil" />}
    </div>
  );
}
