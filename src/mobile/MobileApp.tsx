/* ============================================================================
 * 移动端外壳：单栏 + 底部抽屉 + 全屏预览 + 书架
 * 复用桌面版的六个视图组件，只换布局与交互方式。
 * ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { Preview } from '../Preview';
import { store, useStore, type ViewId } from '../store';
import { projectStats, type Project } from '../types';
import { Btn, Icon, Modal, Toast, type IconName } from '../ui';
import { ScriptLeft, LineInspector } from '../views/Script';
import { ChaptersLeft, ChapterInspector } from '../views/Chapters';
import { CastLeft, CharacterInspector } from '../views/Cast';
import { AssetsLeft, AssetInspector } from '../views/Assets';
import { ThemeLeft, ThemeInspector } from '../views/Theme';
import { PublishLeft, PublishInspector } from '../views/Publish';
import { Bookshelf } from './Bookshelf';
import { isNativeApp, nativeToast, pickFile, readTextFile, type GalBookEntry } from './bridge';
import { normalizeProject } from '../types';
import { ART_TEMPLATES, artProject, type ArtTemplateId } from '../artTemplates';

const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'script', label: '剧本', icon: 'text' },
  { id: 'chapters', label: '章节', icon: 'book' },
  { id: 'cast', label: '角色', icon: 'user' },
  { id: 'assets', label: '素材', icon: 'image' },
  { id: 'theme', label: '主题', icon: 'palette' },
  { id: 'publish', label: '发布', icon: 'rocket' },
];

export default function MobileApp() {
  const state = useStore(s => s);
  const project = state.project;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [reading, setReading] = useState<GalBookEntry | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => { void store.boot(); }, []);

  // 切换视图时收起抽屉，避免上下文错乱
  useEffect(() => { setSheetOpen(false); }, [state.view]);

  // Android 返回键：先由网页逐层关闭，网页说没处理才退出 App
  useEffect(() => {
    (window as unknown as { __galBack?: () => boolean }).__galBack = () => {
      if (reading) { setReading(null); return true; }
      if (previewOpen) {
        // 播放器自己开着弹窗（存档 / 历史 / 设置）时，先关它
        const frame = document.querySelector('.gm-fullscreen iframe') as HTMLIFrameElement | null;
        const player = (frame?.contentWindow as unknown as { __galPlayer?: { panelOpen?: boolean; closePanel?: () => void } } | null)?.__galPlayer;
        if (player?.panelOpen) { player.closePanel?.(); return true; }
        setPreviewOpen(false);
        return true;
      }
      if (shelfOpen) { setShelfOpen(false); return true; }
      if (templateOpen) { setTemplateOpen(false); return true; }
      if (menuOpen) { setMenuOpen(false); return true; }
      if (sheetOpen) { setSheetOpen(false); return true; }
      if (state.guideOpen) { store.toggleGuide(false); return true; }
      return false;
    };
    return () => { delete (window as unknown as { __galBack?: () => boolean }).__galBack; };
  }, [reading, previewOpen, shelfOpen, templateOpen, menuOpen, sheetOpen, state.guideOpen]);

  const stats = useMemo(() => projectStats(project), [project]);

  if (!state.ready) {
    return (
      <div className="gs-boot">
        <div className="gs-boot-mark"><span /><span /><i /></div>
        <h1>Galgame Studio</h1>
        <p>正在打开你的作品…</p>
      </div>
    );
  }

  const selectionLabel = describeSelection(project, state.selection.kind, state.selection.id);

  return (
    <div className="gm-app">
      <header className="gm-top">
        <span className="gm-logo"><span /><span /><i /></span>
        {renaming === null ? (
          <button className="gm-title" onClick={() => setRenaming(project.title)}>
            <b>{project.title || '未命名作品'}</b>
            <small>{stats.lines} 句 · {stats.chapters} 章{isNativeApp() ? ' · App' : ''}</small>
          </button>
        ) : (
          <input
            className="gs-input gm-title-input"
            autoFocus
            value={renaming}
            onChange={event => setRenaming(event.target.value)}
            onBlur={() => { store.setProjectMeta({ title: renaming.trim() || '未命名作品' }); setRenaming(null); }}
            onKeyDown={event => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); if (event.key === 'Escape') setRenaming(null); }}
          />
        )}
        <button className="gm-icon" onClick={() => setPreviewOpen(true)} aria-label="预览"><Icon name="play" size={18} /></button>
        <button className="gm-icon" onClick={() => setMenuOpen(true)} aria-label="更多"><Icon name="settings" size={18} /></button>
      </header>

      <nav className="gm-tabs">
        {VIEWS.map(view => (
          <button key={view.id} className={`gm-tab ${state.view === view.id ? 'is-on' : ''}`} onClick={() => store.setView(view.id)}>
            <Icon name={view.icon} size={15} />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>

      <main className="gm-body">
        {state.view === 'script' && <ScriptLeft />}
        {state.view === 'chapters' && <ChaptersLeft />}
        {state.view === 'cast' && <CastLeft />}
        {state.view === 'assets' && <AssetsLeft />}
        {state.view === 'theme' && <ThemeLeft />}
        {state.view === 'publish' && <PublishLeft />}
      </main>

      <button className={`gm-handle ${selectionLabel ? '' : 'is-idle'}`} onClick={() => selectionLabel && setSheetOpen(true)}>
        <Icon name="edit" size={15} />
        <span>{selectionLabel || '点上面列表里的任意一项来编辑'}</span>
        {selectionLabel && <Icon name="chevron" size={14} />}
      </button>

      {/* 手机上最常用的两个动作常驻：撤销 / 重做 */}
      <div className="gm-undo">
        <button disabled={!state.history.length} onClick={() => store.undo()} aria-label="撤销">
          <Icon name="undo" size={16} />
        </button>
        <button disabled={!state.future.length} onClick={() => store.redo()} aria-label="重做">
          <Icon name="redo" size={16} />
        </button>
      </div>

      {sheetOpen && selectionLabel && (
        <div className="gm-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="gm-sheet" onClick={event => event.stopPropagation()}>
            <div className="gm-sheet-head">
              <span className="gm-sheet-grip" />
              <strong>{selectionLabel}</strong>
              <button className="gm-icon" onClick={() => setSheetOpen(false)} aria-label="关闭"><Icon name="close" size={16} /></button>
            </div>
            <div className="gm-sheet-body">
              {selectionLabel && renderInspector(state.view)}
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="gm-fullscreen">
          <Preview
            project={project}
            index={state.previewIndex}
            syncKey={state.previewKey}
            device="desktop"
            onDeviceChange={() => undefined}
            onIndexChange={(index) => store.setPreviewIndex(index, true)}
          />
          <button className="gm-close" onClick={() => setPreviewOpen(false)} aria-label="关闭预览"><Icon name="close" size={20} /></button>
        </div>
      )}

      {shelfOpen && (
        <Bookshelf
          reading={reading}
          onReadingChange={setReading}
          onClose={() => { setShelfOpen(false); setReading(null); }}
        />
      )}
      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} onShelf={() => { setMenuOpen(false); setShelfOpen(true); }} onTemplate={() => { setMenuOpen(false); setTemplateOpen(true); }} />}
      {templateOpen && <TemplateSheet onClose={() => setTemplateOpen(false)} />}
      {state.guideOpen && <GuideSheet onClose={() => store.toggleGuide(false)} />}
      {state.toast && <Toast text={state.toast.text} tone={state.toast.tone} />}
    </div>
  );
}

function renderInspector(view: ViewId) {
  if (view === 'script') return <LineInspector />;
  if (view === 'chapters') return <ChapterInspector />;
  if (view === 'cast') return <CharacterInspector />;
  if (view === 'assets') return <AssetInspector />;
  if (view === 'theme') return <ThemeInspector />;
  return <PublishInspector />;
}

function describeSelection(project: Project, kind: string, id: string): string {
  if (kind === 'line') {
    const index = project.lines.findIndex(line => line.id === id);
    if (index < 0) return '';
    const line = project.lines[index];
    const speaker = line.speakerId ? project.characters.find(c => c.id === line.speakerId)?.name : '旁白';
    const text = (line.text || '').replace(/\s+/g, ' ').slice(0, 14);
    return `台词 #${String(index + 1).padStart(3, '0')} · ${speaker}：${text}${(line.text || '').length > 14 ? '…' : ''}`;
  }
  if (kind === 'chapter') {
    const chapter = project.chapters.find(c => c.id === id);
    return chapter ? `章节 · ${chapter.title || '未命名'}` : '';
  }
  if (kind === 'character') {
    const character = project.characters.find(c => c.id === id);
    return character ? `角色 · ${character.name || '未命名'}` : '';
  }
  if (kind === 'asset') {
    const asset = project.assets.find(a => a.id === id);
    return asset ? `素材 · ${asset.name}` : '';
  }
  return '';
}

function MenuSheet({ onClose, onShelf, onTemplate }: { onClose: () => void; onShelf: () => void; onTemplate: () => void }) {
  const items: { icon: IconName; label: string; hint: string; action: () => void }[] = [
    { icon: 'book', label: '我的书架', hint: '在应用里玩已经做好的作品', action: onShelf },
    { icon: 'sparkles', label: '换一个模板', hint: '示例作品 / 教学项目 / 空白', action: onTemplate },
    {
      icon: 'open', label: '打开项目文件', hint: '导入 .galproj.json 继续编辑',
      action: () => pickFile('.json,application/json', async (file) => {
        try {
          const text = await readTextFile(file);
          const parsed = JSON.parse(text) as Partial<Project>;
          store.replaceProject(normalizeProject(parsed), `已打开《${parsed.title || '未命名作品'}》`);
          onClose();
        } catch {
          store.toast('这个文件读不出来，可能不是 Galgame Studio 的项目文件', 'warn');
        }
      }),
    },
    { icon: 'help', label: '新手引导', hint: '三步做出你的第一个 galgame', action: () => { onClose(); store.toggleGuide(true); } },
    {
      icon: 'refresh', label: '回到第一句', hint: '预览从这个故事的开头开始',
      action: () => { store.jumpPreview(0); onClose(); nativeToast('已回到开头'); },
    },
  ];
  return (
    <div className="gm-sheet-backdrop" onClick={onClose}>
      <div className="gm-sheet is-menu" onClick={event => event.stopPropagation()}>
        <div className="gm-sheet-head">
          <span className="gm-sheet-grip" />
          <strong>更多</strong>
          <button className="gm-icon" onClick={onClose} aria-label="关闭"><Icon name="close" size={16} /></button>
        </div>
        <div className="gm-sheet-body">
          <div className="gm-menulist">
            {items.map(item => (
              <button key={item.label} className="gm-menuitem" onClick={item.action}>
                <Icon name={item.icon} size={18} />
                <span><b>{item.label}</b><small>{item.hint}</small></span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState('');
  async function pick(kind: 'demo' | 'starter' | 'blank' | ArtTemplateId) {
    setBusy(kind);
    const demo = await import('../demo');
    if (kind === 'demo') store.replaceProject(demo.demoProject(), '已载入示例作品《与你，坠入》');
    else if (kind === 'starter') store.replaceProject(demo.starterProject(), '已新建教学项目');
    else if (kind === 'blank') store.replaceProject(normalizeProject({ title: '我的第一部视觉小说' }), '已新建空白项目');
    else store.replaceProject(artProject(kind), '已载入美术模板');
    setBusy('');
    onClose();
  }
  const options = [
    { kind: 'demo' as const, icon: 'star' as IconName, title: '示例作品', hint: '完整的 3 章 58 句，含背景立绘与结局' },
    { kind: 'starter' as const, icon: 'sparkles' as IconName, title: '教学项目', hint: '6 句讲清编辑器怎么用' },
    { kind: 'blank' as const, icon: 'text' as IconName, title: '完全空白', hint: '一页白纸，从零开始' },
  ];
  return (
    <div className="gm-sheet-backdrop" onClick={onClose}>
      <div className="gm-sheet is-menu" onClick={event => event.stopPropagation()}>
        <div className="gm-sheet-head">
          <span className="gm-sheet-grip" />
          <strong>选择模板</strong>
          <button className="gm-icon" onClick={onClose} aria-label="关闭"><Icon name="close" size={16} /></button>
        </div>
        <div className="gm-sheet-body">
          <div className="gm-menulist">
            {ART_TEMPLATES.map(template => <button key={template.id} className="gm-menuitem" disabled={!!busy} onClick={() => void pick(template.id)}>
              <img className="gm-template-cover" src={template.image} alt={template.location} />
              <span><b>{template.title}</b><small>{template.hint}</small></span><Icon name="chevron" size={15} />
            </button>)}
            {options.map(option => (
              <button key={option.kind} className="gm-menuitem" disabled={!!busy} onClick={() => void pick(option.kind)}>
                <Icon name={option.icon} size={18} />
                <span><b>{option.title}</b><small>{option.hint}</small></span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <p className="gs-note">切换模板会替换当前项目。当前项目已自动保存在本机，也可以先在「发布」里导出项目文件备份。</p>
        </div>
      </div>
    </div>
  );
}

function GuideSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="三步做出你的第一个 galgame" subtitle="QUICK START" onClose={onClose}
      footer={<>
        <Btn kind="quiet" onClick={onClose}>知道了</Btn>
        <Btn kind="primary" icon="play" onClick={() => { store.jumpPreview(0); onClose(); }}>先看一遍示例</Btn>
      </>}>
      <div className="gs-guide">
        <article>
          <span className="gs-guide-no">01</span>
          <h3>上面切页签，下面点一条来改</h3>
          <p>「剧本」里点任意一句，底部的把手会亮起来——点它就能改说话人、台词、表情和演出方式。中间不用退出编辑，随时点右上角 ▶ 全屏预览。</p>
        </article>
        <article>
          <span className="gs-guide-no">02</span>
          <h3>用手机相册里的照片当素材</h3>
          <p>「素材」里点导入就能从相册选图（也可以直接拍照）。「角色」里上传的立绘会自动去掉纯色背景，手机上也能调抠图强度。</p>
        </article>
        <article>
          <span className="gs-guide-no">03</span>
          <h3>导出成一个文件，发给谁都能玩</h3>
          <p>「发布」里导出单文件 HTML：会保存到手机的「下载」目录，同时进「我的书架」，在这里点开就能直接玩。</p>
        </article>
      </div>
    </Modal>
  );
}
