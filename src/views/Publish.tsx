/* 发布视图：导出成一个可以发的 HTML，或者备份项目文件 */
import { useState } from 'react';
import { buildProjectFile, buildStandaloneHtml, safeName } from '../exporter';
import { isNativeApp, pickFile, readTextFile, saveTextFile } from '../mobile/bridge';
import { store, useProject } from '../store';
import { formatBytes, normalizeProject, projectStats, type Project } from '../types';
import { Btn, Empty, Field, Icon, Section, Toggle } from '../ui';

interface Check { ok: boolean; level: 'info' | 'warn'; title: string; hint: string; action?: () => void }

function buildChecks(project: Project, stats: ReturnType<typeof projectStats>): Check[] {
  const backgrounds = project.assets.filter(a => a.kind === 'background');
  const sprites = project.assets.filter(a => a.kind === 'sprite');
  const chaptersWithoutBg = project.chapters.filter(c => !c.backgroundId);
  const emptyLines = project.lines.filter(l => !(l.text || '').trim());
  const usedIds = new Set<string>();
  project.chapters.forEach(c => { if (c.backgroundId) usedIds.add(c.backgroundId); if (c.ambienceAssetId) usedIds.add(c.ambienceAssetId); });
  project.lines.forEach(l => { if (l.cgAssetId) usedIds.add(l.cgAssetId); });
  project.characters.forEach(c => c.expressions.forEach(e => { if (e.assetId) usedIds.add(e.assetId); }));
  const unused = project.assets.filter(a => !usedIds.has(a.id));
  return [
    { ok: project.lines.length > 0, level: 'warn', title: '有台词内容', hint: `目前共 ${stats.lines} 句` },
    { ok: backgrounds.length > 0, level: 'warn', title: '至少有一张背景图', hint: backgrounds.length ? `${backgrounds.length} 张` : '没有背景图时，画面只有底色，观感会比较空', action: () => store.setView('assets') },
    { ok: sprites.length > 0, level: 'info', title: '有立绘会让角色更立体', hint: sprites.length ? `${sprites.length} 张立绘` : '也可以做成纯文字作品，不是必须', action: () => store.setView('cast') },
    { ok: chaptersWithoutBg.length === 0, level: 'info', title: '每一章都有背景', hint: chaptersWithoutBg.length ? `${chaptersWithoutBg.length} 章还没设置背景：${chaptersWithoutBg.slice(0, 3).map(c => c.title).join('、')}` : '全部章节已配图', action: () => store.setView('chapters') },
    { ok: emptyLines.length === 0, level: 'info', title: '没有空台词', hint: emptyLines.length ? `${emptyLines.length} 句是空的，翻页时会一闪而过` : '台词都写好了' },
    { ok: unused.length === 0, level: 'info', title: '素材都被用上', hint: unused.length ? `${unused.length} 个素材没被使用（不影响导出，只是会增加文件体积）` : '没有闲置素材' },
    { ok: project.title.trim().length > 0, level: 'warn', title: '作品有名字', hint: project.title || '还没有标题' },
  ];
}

export function PublishLeft() {
  const project = useProject();
  const stats = projectStats(project);
  const checks = buildChecks(project, stats);
  const warnings = checks.filter(c => !c.ok && c.level === 'warn');

  return (
    <>
      <Section dense title="发布前检查" hint={warnings.length ? `${warnings.length} 项建议处理` : '一切就绪'}>
        <ul className="gs-checklist">
          {checks.map(check => (
            <li key={check.title} className={`${check.ok ? 'is-ok' : check.level === 'warn' ? 'is-warn' : 'is-info'}`}
              onClick={check.action} role={check.action ? 'button' : undefined}>
              <Icon name={check.ok ? 'check' : check.level === 'warn' ? 'warn' : 'dot'} size={13} />
              <span><b>{check.title}</b><small>{check.hint}</small></span>
            </li>
          ))}
        </ul>
      </Section>

      <Section dense title="作品数据">
        <div className="gs-stats is-grid">
          <div><strong>{stats.chapters}</strong><span>章节</span></div>
          <div><strong>{stats.lines}</strong><span>台词</span></div>
          <div><strong>{stats.characters}</strong><span>角色</span></div>
          <div><strong>{stats.assets}</strong><span>素材</span></div>
          <div><strong>{stats.chars}</strong><span>字数</span></div>
          <div><strong>{formatBytes(stats.bytes)}</strong><span>素材体积</span></div>
        </div>
      </Section>
    </>
  );
}

export function PublishInspector() {
  const project = useProject();
  const [inlineAssets, setInlineAssets] = useState(true);
  const [webFonts, setWebFonts] = useState(true);
  const [optimize, setOptimize] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ filename: string; bytes: number; notes: string[] } | null>(null);

  async function exportHtml() {
    setBusy(true);
    setResult(null);
    try {
      const built = await buildStandaloneHtml(project, { inlineAssets, webFonts, optimize });
      const saved = await saveTextFile(built.filename, built.html, 'text/html');
      setResult({
        filename: built.filename,
        bytes: built.bytes,
        notes: [saved.message, ...built.notes],
      });
      store.toast(saved.ok ? (isNativeApp() ? '已保存，可在书架里直接玩' : '已导出可以发布的单文件 HTML') : saved.message, saved.ok ? 'ok' : 'warn');
    } catch (error) {
      store.toast(error instanceof Error ? error.message : '导出失败', 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function exportProjectFile() {
    const file = buildProjectFile(project);
    const saved = await saveTextFile(file.filename, file.content, 'application/json');
    store.toast(saved.message, saved.ok ? 'ok' : 'warn');
  }

  function openProject() {
    pickFile('.json,application/json', async (file) => {
      try {
        const text = await readTextFile(file);
        const parsed = JSON.parse(text) as Partial<Project>;
        store.replaceProject(normalizeProject(parsed), `已打开《${parsed.title || '未命名作品'}》`);
      } catch {
        store.toast('这个文件读不出来，可能不是 Galgame Studio 的项目文件', 'warn');
      }
    });
  }

  return (
    <>
      <Section title="导出一份可以玩的游戏" hint="一个 .html 文件，双击就能玩，也能直接丢到网上">
        <Field label="把图片一起打包进 HTML" hint="关掉的话文件更小，但要把图片放在同目录">
          <Toggle value={inlineAssets} onChange={setInlineAssets} label="内联素材" />
        </Field>
        <Field label="自动压缩图片" hint="重编码为 WebP，通常能小一个数量级">
          <Toggle value={optimize} onChange={setOptimize} label="自动压缩图片" />
        </Field>
        <Field label="使用在线字体（需要联网）" hint="关掉则用系统字体，离线也不走样">
          <Toggle value={webFonts} onChange={setWebFonts} label="在线字体" />
        </Field>
        <Btn kind="primary" size="lg" icon="rocket" full disabled={busy} onClick={() => void exportHtml()}>
          {busy ? '正在打包…' : '导出单文件 HTML'}
        </Btn>
        {result && (
          <div className="gs-result">
            <Icon name="check" size={14} />
            <div>
              <strong>{result.filename}</strong>
              <small>{formatBytes(result.bytes)}</small>
              {result.notes.map((note, i) => <p key={i} className="gs-note">{note}</p>)}
            </div>
          </div>
        )}
        <ul className="gs-tips">
          <li>想发给朋友：直接把这个 HTML 发过去，对方双击就能读。</li>
          <li>想放到网上：扔进任何静态空间（GitHub Pages、Vercel、图床都行）。</li>
          <li>{isNativeApp() ? '已经存进手机「下载/GalgameStudio」，也会出现在「我的书架」里。' : '手机上也能玩：传到手机浏览器直接打开。'}</li>
        </ul>
      </Section>

      <Section title="备份 / 迁移" hint="项目文件里包含全部文字与素材，可以随时接着改">
        <Btn icon="save" full onClick={() => void exportProjectFile()}>导出项目文件（{safeName(project.title)}.galproj.json）</Btn>
        <Btn icon="open" full onClick={openProject}>打开一个项目文件</Btn>
      </Section>

      <Section title="清空重来">
        <Btn icon="trash" kind="danger" full onClick={async () => {
          if (!window.confirm('确定要新建一个空白项目吗？当前项目会被替换（可以先导出项目文件备份）。')) return;
          const demo = await import('../demo');
          store.replaceProject(demo.starterProject(), '已新建教学项目');
        }}>新建一个空白项目</Btn>
        <p className="gs-note">当前项目会自动保存，新建后旧项目会被替换，建议先导出项目文件。</p>
      </Section>

      {!project.assets.length && (
        <Empty icon="image" title="还没有任何素材" hint="没有图片也能做成纯文字视觉小说，但加上背景会更像游戏。" />
      )}
    </>
  );
}
