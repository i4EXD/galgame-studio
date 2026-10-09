/* Galgame Studio · 编辑器主壳（桌面两栏版 / 移动单栏版） */
import { useEffect, useState } from 'react';
import MobileApp from './mobile/MobileApp';
import { Preview, type Device } from './Preview';
import { store, useStore, type ViewId } from './store';
import { buildProjectFile, download } from './exporter';
import { normalizeProject, projectStats, type Project } from './types';
import { Btn, Icon, Modal, Toast, type IconName } from './ui';
import { ScriptLeft, LineInspector } from './views/Script';
import { ChaptersLeft, ChapterInspector } from './views/Chapters';
import { CastLeft, CharacterInspector } from './views/Cast';
import { AssetsLeft, AssetInspector } from './views/Assets';
import { ThemeLeft, ThemeInspector } from './views/Theme';
import { PublishLeft, PublishInspector } from './views/Publish';
import { ART_TEMPLATES, artProject, type ArtTemplateId } from './artTemplates';

const VIEWS: { id: ViewId; label: string; icon: IconName; hint: string }[] = [
  { id: 'script', label: '剧本', icon: 'text', hint: '写台词、选表情、排顺序（Ctrl+1）' },
  { id: 'chapters', label: '章节', icon: 'book', hint: '一章一段场景（Ctrl+2）' },
  { id: 'cast', label: '角色', icon: 'user', hint: '人物与表情立绘（Ctrl+3）' },
  { id: 'assets', label: '素材', icon: 'image', hint: '背景、CG、音频（Ctrl+4）' },
  { id: 'theme', label: '主题', icon: 'palette', hint: '配色、字体、氛围（Ctrl+5）' },
  { id: 'publish', label: '发布', icon: 'rocket', hint: '导出游戏或备份（Ctrl+6）' },
];

/** 手机 / 窄屏 / Android App 一律走移动版外壳 */
function useIsMobile(): boolean {
  const detect = () => window.matchMedia('(max-width: 860px)').matches
    || /Android|iPhone|iPod|iPad|Mobile|HarmonyOS/i.test(navigator.userAgent);
  const [mobile, setMobile] = useState(detect);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const update = () => setMobile(detect());
    query.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return mobile;
}

export default function App() {
  const mobile = useIsMobile();
  return mobile ? <MobileApp /> : <DesktopApp />;
}

function DesktopApp() {
  const state = useStore(s => s);
  const [device, setDevice] = useState<Device>('desktop');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  useEffect(() => { void store.boot(); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      const typing = (event.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if (meta && event.key.toLowerCase() === 'z' && !typing) {
        event.preventDefault();
        if (event.shiftKey) store.redo(); else store.undo();
      } else if (meta && event.key.toLowerCase() === 'y' && !typing) {
        event.preventDefault();
        store.redo();
      } else if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void store.persist();
        store.toast('已保存');
      } else if (meta && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        store.setView(VIEWS[Number(event.key) - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!state.ready) {
    return (
      <div className="gs-boot">
        <div className="gs-boot-mark"><span /><span /><i /></div>
        <h1>Galgame Studio</h1>
        <p>正在打开你的作品…</p>
      </div>
    );
  }

  const project = state.project;
  const stats = projectStats(project);

  return (
    <div className="gs-app">
      <header className="gs-topbar">
        <div className="gs-brand">
          <span className="gs-brand-mark"><span /><span /><i /></span>
          <span className="gs-brand-text">
            <strong>Galgame Studio</strong>
            <small>视觉小说编辑器</small>
          </span>
        </div>

        <div className="gs-title-edit">
          {titleDraft === null ? (
            <button className="gs-title-button" onClick={() => setTitleDraft(project.title)} title="点击修改作品名">
              《{project.title}》
            </button>
          ) : (
            <input
              className="gs-input gs-title-input"
              autoFocus
              value={titleDraft}
              onChange={event => setTitleDraft(event.target.value)}
              onBlur={() => { store.setProjectMeta({ title: titleDraft.trim() || '未命名作品' }); setTitleDraft(null); }}
              onKeyDown={event => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); if (event.key === 'Escape') setTitleDraft(null); }}
            />
          )}
          <span className="gs-save-state">
            {state.saving ? '保存中…' : state.savedAt ? `已自动保存 · ${new Date(state.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : state.storageNote}
          </span>
        </div>

        <nav className="gs-views">
          {VIEWS.map(view => (
            <button key={view.id} className={`gs-view ${state.view === view.id ? 'is-on' : ''}`}
              onClick={() => store.setView(view.id)} title={view.hint}>
              <Icon name={view.icon} size={15} />
              <span>{view.label}</span>
            </button>
          ))}
        </nav>

        <div className="gs-topactions">
          <Btn icon="undo" kind="quiet" size="sm" disabled={!state.history.length} title="撤销（Ctrl+Z）" onClick={() => store.undo()} />
          <Btn icon="redo" kind="quiet" size="sm" disabled={!state.future.length} title="重做（Ctrl+Shift+Z）" onClick={() => store.redo()} />
          <Btn icon="help" kind="quiet" size="sm" title="新手引导" onClick={() => store.toggleGuide(true)} />
          <Btn icon="sparkles" size="sm" onClick={() => setTemplateOpen(true)}>模板</Btn>
          <Btn icon="rocket" kind="primary" size="sm" onClick={() => store.setView('publish')}>导出</Btn>
        </div>
      </header>

      <main className="gs-main">
        <aside className="gs-col gs-col-left">
          {state.view === 'script' && <ScriptLeft />}
          {state.view === 'chapters' && <ChaptersLeft />}
          {state.view === 'cast' && <CastLeft />}
          {state.view === 'assets' && <AssetsLeft />}
          {state.view === 'theme' && <ThemeLeft />}
          {state.view === 'publish' && <PublishLeft />}
        </aside>

        <section className="gs-col gs-col-center">
          <Preview
            project={project}
            index={state.previewIndex}
            syncKey={state.previewKey}
            device={device}
            onDeviceChange={setDevice}
            onIndexChange={(index) => store.setPreviewIndex(index, true)}
          />
          <div className="gs-center-foot">
            <span className="gs-foot-item"><Icon name="text" size={12} />第 {Math.min(state.previewIndex + 1, stats.lines)} / {stats.lines} 句</span>
            <span className="gs-foot-item"><Icon name="book" size={12} />{stats.chapters} 章</span>
            <span className="gs-foot-item"><Icon name="user" size={12} />{stats.characters} 位角色</span>
            <span className="gs-foot-item"><Icon name="image" size={12} />{stats.assets} 个素材</span>
            <span className="gs-foot-hint">提示：预览里可以像玩家一样点击翻页、存档、切章节</span>
          </div>
        </section>

        <aside className="gs-col gs-col-right">
          {state.view === 'script' && <LineInspector />}
          {state.view === 'chapters' && <ChapterInspector />}
          {state.view === 'cast' && <CharacterInspector />}
          {state.view === 'assets' && <AssetInspector />}
          {state.view === 'theme' && <ThemeInspector />}
          {state.view === 'publish' && <PublishInspector />}
        </aside>
      </main>

      {state.toast && <Toast text={state.toast.text} tone={state.toast.tone} />}
      {state.guideOpen && <GuideModal onClose={() => store.toggleGuide(false)} />}
      {templateOpen && (
        <TemplateModal
          onClose={() => setTemplateOpen(false)}
          onPick={(project2, label) => { store.replaceProject(project2, label); setTemplateOpen(false); }}
          current={project}
        />
      )}
    </div>
  );
}

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal wide title="三步做出你的第一个 galgame" subtitle="QUICK START" onClose={onClose}
      footer={<>
        <Btn kind="quiet" onClick={onClose}>知道了</Btn>
        <Btn kind="solid" icon="film" onClick={() => { store.jumpPreview(0); onClose(); }}>先看一遍示例</Btn>
        <Btn kind="primary" icon="rocket" onClick={() => { store.setView('publish'); onClose(); }}>直接去导出</Btn>
      </>}>
      <div className="gs-guide">
        <article>
          <span className="gs-guide-no">01</span>
          <h3>左边挑一句，中间立刻看到效果</h3>
          <p>现在打开的是示例作品《与你，坠入》。左边点任意一句台词，中间的预览会跳到那一句；点标题上的「章节」小标签可以只看某一章。</p>
        </article>
        <article>
          <span className="gs-guide-no">02</span>
          <h3>右边改文字、换表情、上传自己的图</h3>
          <p>在「角色」里上传人物立绘（纯色背景会自动抠掉），在「素材」里拖入背景图，在「章节」里给每一章指定背景——这就是一部 galgame 需要的全部。</p>
        </article>
        <article>
          <span className="gs-guide-no">03</span>
          <h3>点「发布」导出一个 HTML，发给谁都能玩</h3>
          <p>导出的是一个单独的 .html 文件：双击就能读，丢到网上就能分享。项目也会自动保存在这个浏览器里，随时回来接着写。</p>
        </article>
        <div className="gs-guide-tips">
          <span><Icon name="check" size={13} />不用担心改坏：Ctrl+Z 随时撤销，最多 60 步</span>
          <span><Icon name="check" size={13} />不想用示例？点上面的「模板」换成空白项目</span>
          <span><Icon name="check" size={13} />每写几句就自动保存一次</span>
        </div>
      </div>
    </Modal>
  );
}

function TemplateModal({ onClose, onPick, current }: { onClose: () => void; onPick: (project: Project, label: string) => void; current: Project }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function pick(kind: 'demo' | 'starter' | 'blank' | ArtTemplateId) {
    setLoading(kind);
    const demo = await import('./demo');
    if (kind === 'demo') onPick(demo.demoProject(), '已载入示例作品《与你，坠入》');
    else if (kind === 'starter') onPick(demo.starterProject(), '已新建教学项目');
    else if (kind === 'blank') onPick(normalizeProject({ title: '我的第一部视觉小说', settings: { ...current.settings, titleScreen: true } } as Partial<Project>), '已新建空白项目');
    else onPick(artProject(kind), '已载入美术模板');
    setLoading(null);
  }

  return (
    <Modal title="从一个模板开始" subtitle="NEW PROJECT" onClose={onClose} wide>
      <div className="gs-templates">
        {ART_TEMPLATES.map(template => <button key={template.id} className="gs-template" disabled={!!loading} onClick={() => void pick(template.id)}>
          <img className="gs-template-cover" src={template.image} alt={template.location} />
          <strong>{template.title}</strong><p>{template.hint}</p><small>原创场景 · 6 句开场</small>
        </button>)}
        <button className="gs-template" disabled={!!loading} onClick={() => void pick('demo')}>
          <span className="gs-template-icon"><Icon name="star" size={20} /></span>
          <strong>示例作品 · 与你，坠入</strong>
          <p>完整的 3 章 55 句视觉小说，含背景、立绘、事件 CG 与结局。适合「先看能做成什么样」，然后照着改。</p>
          <small>推荐第一次打开时使用</small>
        </button>
        <button className="gs-template" disabled={!!loading} onClick={() => void pick('starter')}>
          <span className="gs-template-icon"><Icon name="sparkles" size={20} /></span>
          <strong>教学项目 · 6 句上手</strong>
          <p>用 6 句台词讲清编辑器怎么用：改文字、换说话人、加背景、加立绘、导出。三分钟读完，然后开始写自己的。</p>
          <small>推荐给第一次做 galgame 的人</small>
        </button>
        <button className="gs-template" disabled={!!loading} onClick={() => void pick('blank')}>
          <span className="gs-template-icon"><Icon name="text" size={20} /></span>
          <strong>完全空白</strong>
          <p>一张白纸：一个章节、一位角色、两句台词。适合心里已经有故事的人。</p>
          <small>最快，但什么都得自己来</small>
        </button>
      </div>
      <p className="gs-note">切换模板会替换当前项目。当前项目已自动保存在浏览器里，也可以先在「发布」里导出项目文件作为备份。</p>
    </Modal>
  );
}
