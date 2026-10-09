/* ============================================================================
 * 编辑器状态：不可变项目数据 + 撤销/重做 + 自动保存
 * 历史记录只保存对象引用（未改动的部分被共享），因此大项目也不会吃内存。
 * ========================================================================== */

import { useSyncExternalStore } from 'react';
import {
  blankProject, deepClone, normalizeProject, uid,
  type Asset, type AssetKind, type Chapter, type Character, type Expression, type Line, type Project,
} from './types';
import { loadProject, saveProject, storageInfo } from './persist';
import { parseScript } from './scriptImport';

export type ViewId = 'script' | 'chapters' | 'cast' | 'assets' | 'theme' | 'publish';
export type SelectionKind = 'line' | 'chapter' | 'character' | 'asset' | 'expression' | 'project';
export interface Selection { kind: SelectionKind; id: string }

export interface Toast { id: number; text: string; tone: 'ok' | 'warn' }

interface Snapshot {
  label: string;
  project: Project;
  at: number;
  /** 同一 mergeKey 的连续修改会合并成一步历史（打字、拖滑块不该压满撤销栈） */
  mergeKey?: string;
}

/** 同 key 的连续修改在这个时间窗内算「同一步」 */
const MERGE_WINDOW = 2000;

export interface State {
  project: Project;
  view: ViewId;
  selection: Selection;
  history: Snapshot[];
  future: Snapshot[];
  savedAt: number | null;
  saving: boolean;
  storageNote: string;
  toast: Toast | null;
  previewIndex: number;
  previewKey: number;
  ready: boolean;
  guideOpen: boolean;
  subtitlePreviewOn: boolean;
}

type Listener = () => void;

const MAX_HISTORY = 60;

function chapterEnd(project: Project, lines: Line[], chapterId: string): number {
  const order = new Map(project.chapters.map((chapter, index) => [chapter.id, index]));
  const target = order.get(chapterId) ?? -1;
  const next = lines.findIndex(line => (order.get(line.chapterId) ?? -1) > target);
  return next < 0 ? lines.length : next;
}

class Store {
  state: State = {
    project: blankProject(),
    view: 'script',
    selection: { kind: 'line', id: '' },
    history: [],
    future: [],
    savedAt: null,
    saving: false,
    storageNote: storageInfo().note,
    toast: null,
    previewIndex: 0,
    previewKey: 0,
    ready: false,
    guideOpen: false,
    subtitlePreviewOn: true,
  };

  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;
  private toastTimer: number | null = null;
  /** 事务开始时的项目快照：事务内的多次 update 只产生一步历史 */
  private batching: Project | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = () => this.state;

  private emit(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  async boot() {
    if (this.state.ready) return;   // 旋转屏幕 / 切换外壳时会重复调用，已经加载过就直接返回
    const report = (message: string) => {
      const fatal = (window as unknown as { __gsFatal?: (text: string) => void }).__gsFatal;
      if (fatal) fatal(`[启动] ${message}`);
    };
    let project: Project | null = null;
    let slim = false;
    try {
      const loaded = await loadProject();
      if (loaded.project) {
        project = normalizeProject(loaded.project as Partial<Project>);
        slim = loaded.slim;
      }
    } catch (error) {
      report(`读取本地项目失败：${error instanceof Error ? error.message : String(error)}`);
    }
    const first = !project;
    const initial = project || (await import('./demo')).demoProject();
    this.emit({
      project: initial,
      ready: true,
      guideOpen: first,
      selection: { kind: 'chapter', id: initial.chapters[0].id },
      previewIndex: 0,
      previewKey: this.state.previewKey + 1,
    });
    if (slim) {
      // 上次项目超出浏览器容量，只留下了文字；必须让用户知道素材需要重新导入
      const missing = initial.assets.filter(asset => !asset.src).length;
      report(`上次的项目太大，浏览器只保存下了文字部分：`
        + `${missing} 个素材的图片没有保留。请用「发布 → 打开项目文件」恢复备份，或重新上传这些图。`);
      this.toast(`素材没有完整保存（${missing} 个），请检查「发布」页`, 'warn');
    }
    if (first) void this.persist();
  }

  /* ------------------------------------------------------------ 变更入口 */

  update(mutator: (project: Project) => Project, label: string, options: { history?: boolean; silent?: boolean; mergeKey?: string } = {}) {
    const previous = this.state.project;
    const next = mutator(previous);
    if (next === previous) return;
    const skipHistory = options.history === false || this.batching !== null;
    let history = this.state.history;
    if (!skipHistory) {
      const last = history[history.length - 1];
      const canMerge = !!options.mergeKey
        && !!last
        && last.mergeKey === options.mergeKey
        && Date.now() - last.at < MERGE_WINDOW;
      if (canMerge) {
        // 合并：保留最早的快照（撤销一次就回到开始输入之前）
        history = [...history.slice(0, -1), { ...last, at: Date.now() }];
      } else {
        history = [...history, { label, project: previous, at: Date.now(), mergeKey: options.mergeKey }].slice(-MAX_HISTORY);
      }
    }
    const preview = options.silent ? this.state.previewKey : this.state.previewKey + 1;
    this.emit({ project: next, history, future: skipHistory ? this.state.future : [], previewKey: preview });
    this.scheduleSave();
  }

  /**
   * 把一串操作合并成「一步」历史：一次上传（导入素材 + 分配表情）、一次模板套用等，
   * 撤销时应该一次退回，而不是让用户连按好几次。
   */
  batch(label: string, fn: () => void) {
    if (this.batching) { fn(); return; }
    const start = this.state.project;
    this.batching = start;
    try {
      fn();
    } finally {
      this.batching = null;
    }
    if (this.state.project === start) return;
    this.emit({
      history: [...this.state.history, { label, project: start, at: Date.now() }].slice(-MAX_HISTORY),
      future: [],
    });
    this.scheduleSave();
  }

  undo() {
    const { history, project, future } = this.state;
    if (!history.length) return;
    const entry = history[history.length - 1];
    this.emit({
      project: entry.project,
      history: history.slice(0, -1),
      future: [{ label: entry.label, project, at: Date.now() }, ...future].slice(0, MAX_HISTORY),
      previewKey: this.state.previewKey + 1,
    });
    this.toast(`已撤销：${entry.label}`);
    this.scheduleSave();
  }

  redo() {
    const { future, project, history } = this.state;
    if (!future.length) return;
    const entry = future[0];
    this.emit({
      project: entry.project,
      future: future.slice(1),
      history: [...history, { label: entry.label, project, at: Date.now() }],
      previewKey: this.state.previewKey + 1,
    });
    this.toast(`已重做：${entry.label}`);
    this.scheduleSave();
  }

  setView(view: ViewId) {
    const patch: Partial<State> = { view };
    const project = this.state.project;
    if (view === 'chapters' && this.state.selection.kind !== 'chapter') patch.selection = { kind: 'chapter', id: project.chapters[0].id };
    if (view === 'cast' && this.state.selection.kind !== 'character') patch.selection = { kind: 'character', id: project.characters[0]?.id || '' };
    this.emit(patch);
  }

  select(kind: SelectionKind, id: string) {
    this.emit({ selection: { kind, id } });
  }

  setPreviewIndex(index: number, fromPlayer = false) {
    this.emit({ previewIndex: index, ...(fromPlayer ? {} : { previewKey: this.state.previewKey + 1 }) });
  }

  jumpPreview(index: number) {
    this.emit({ previewIndex: index, previewKey: this.state.previewKey + 1 });
  }

  toggleGuide(open?: boolean) {
    this.emit({ guideOpen: open == null ? !this.state.guideOpen : open });
  }

  toast(text: string, tone: 'ok' | 'warn' = 'ok') {
    this.emit({ toast: { id: Date.now(), text, tone } });
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.emit({ toast: null }), 2600);
  }

  async persist() {
    this.emit({ saving: true });
    const storage = await saveProject(this.state.project);
    this.emit({ saving: false, savedAt: Date.now(), storageNote: storage.note });
  }

  private scheduleSave() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { void this.persist(); }, 900);
  }

  /* ------------------------------------------------------------ 项目级操作 */

  replaceProject(project: Project, label: string, options: { resetHistory?: boolean } = {}) {
    const next = normalizeProject(project);
    this.emit({
      project: next,
      history: options.resetHistory === false ? this.state.history : [],
      future: [],
      selection: { kind: 'chapter', id: next.chapters[0].id },
      view: 'script',
      previewIndex: 0,
      previewKey: this.state.previewKey + 1,
    });
    this.toast(label);
    this.scheduleSave();
  }

  /* ------------------------------------------------------------------ 台词 */

  addLine(chapterId: string, afterId?: string, preset: Partial<Line> = {}) {
    const line: Line = {
      id: uid('ln'), chapterId, speakerId: null, text: '新的一句台词。', expressionId: '',
      presentation: 'sprite', cgAssetId: '', ...preset,
    };
    this.update((project) => {
      const lines = [...project.lines];
      const at = afterId ? lines.findIndex(l => l.id === afterId && l.chapterId === line.chapterId) : -1;
      lines.splice(at >= 0 ? at + 1 : chapterEnd(project, lines, line.chapterId), 0, line);
      return { ...project, lines };
    }, '新增台词');
    this.select('line', line.id);
    this.jumpPreview(this.state.project.lines.findIndex(l => l.id === line.id));
    return line;
  }

  updateLine(id: string, patch: Partial<Line>, label = '修改台词') {
    // 连续敲字 / 连续拖同一个控件算一步，撤销时不会退成一个字一个字
    this.update(
      project => ({ ...project, lines: project.lines.map(l => (l.id === id ? { ...l, ...patch } : l)) }),
      label,
      { mergeKey: `line:${id}:${Object.keys(patch).sort().join(',')}`, silent: patch.text !== undefined },
    );
  }

  deleteLine(id: string) {
    const project = this.state.project;
    const index = project.lines.findIndex(l => l.id === id);
    if (index < 0) return;
    this.update(p => ({ ...p, lines: p.lines.filter(l => l.id !== id) }), '删除台词');
    const next = this.state.project.lines[Math.min(index, this.state.project.lines.length - 1)];
    if (next) { this.select('line', next.id); this.jumpPreview(Math.min(index, this.state.project.lines.length - 1)); }
  }

  duplicateLine(id: string) {
    const project = this.state.project;
    const index = project.lines.findIndex(l => l.id === id);
    if (index < 0) return;
    const clone: Line = { ...project.lines[index], id: uid('ln') };
    this.update(p => {
      const lines = [...p.lines];
      lines.splice(index + 1, 0, clone);
      return { ...p, lines };
    }, '复制台词');
    this.select('line', clone.id);
    this.jumpPreview(index + 1);
  }

  moveLine(id: string, delta: number) {
    this.update((project) => {
      const lines = [...project.lines];
      const from = lines.findIndex(l => l.id === id);
      if (from < 0) return project;
      const to = from + delta;
      if (to < 0 || to >= lines.length) return project;
      // 只在同一章内移动，避免剧本顺序错乱
      if (lines[to].chapterId !== lines[from].chapterId) return project;
      const [item] = lines.splice(from, 1);
      lines.splice(to, 0, item);
      return { ...project, lines };
    }, delta < 0 ? '上移台词' : '下移台词');
    const index = this.state.project.lines.findIndex(l => l.id === id);
    if (index >= 0) this.jumpPreview(index);
  }

  moveLineToChapter(id: string, chapterId: string) {
    const project = this.state.project;
    const line = project.lines.find(l => l.id === id);
    if (!line || line.chapterId === chapterId || !project.chapters.some(c => c.id === chapterId)) return;
    const lines = project.lines.filter(l => l.id !== id);
    const index = chapterEnd(project, lines, chapterId);
    lines.splice(index, 0, { ...line, chapterId });
    this.update(p => ({ ...p, lines }), '移动到其他章节');
    this.jumpPreview(index);
  }

  importScript(chapterId: string, text: string) {
    const project = this.state.project;
    if (!project.chapters.some(c => c.id === chapterId)) return 0;
    const imported = parseScript(text, chapterId, project.characters);
    if (!imported.length) return 0;
    const lines = [...project.lines];
    const index = chapterEnd(project, lines, chapterId);
    lines.splice(index, 0, ...imported);
    this.update(p => ({ ...p, lines }), `导入 ${imported.length} 句台词`);
    this.select('line', imported[0].id);
    this.jumpPreview(index);
    return imported.length;
  }

  duplicateChapter(id: string) {
    const project = this.state.project;
    const index = project.chapters.findIndex(c => c.id === id);
    if (index < 0) return;
    const copy = { ...project.chapters[index], id: uid('ch'), title: `${project.chapters[index].title} · 副本`, ambienceFreqs: [...project.chapters[index].ambienceFreqs] };
    const chapters = [...project.chapters];
    chapters.splice(index + 1, 0, copy);
    const copies = project.lines.filter(l => l.chapterId === id).map(l => ({ ...l, id: uid('ln'), chapterId: copy.id }));
    const lines = [...project.lines];
    lines.splice(chapterEnd({ ...project, chapters }, lines, copy.id), 0, ...copies);
    this.update(p => ({ ...p, chapters, lines }), '复制整章');
    this.select('chapter', copy.id);
    return copy;
  }

  /* ------------------------------------------------------------------ 章节 */

  addChapter() {
    const project = this.state.project;
    const order = project.chapters.length + 1;
    const chapter: Chapter = {
      id: uid('ch'),
      number: String(order).padStart(2, '0'),
      title: `第${order}章 · 新章节`,
      subtitle: '写一句副标题。',
      description: '',
      level: `SCENE ${String(order).padStart(2, '0')}`,
      location: '地点',
      backgroundId: '',
      tint: '',
      tintStrength: 0.75,
      ambienceLabel: '',
      ambienceFreqs: [],
      ambienceAssetId: '',
    };
    this.update(p => ({ ...p, chapters: [...p.chapters, chapter] }), '新增章节');
    this.select('chapter', chapter.id);
    this.setView('chapters');
    return chapter;
  }

  updateChapter(id: string, patch: Partial<Chapter>, label = '修改章节') {
    this.update(
      project => ({ ...project, chapters: project.chapters.map(c => (c.id === id ? { ...c, ...patch } : c)) }),
      label,
      { mergeKey: `chapter:${id}:${Object.keys(patch).sort().join(',')}` },
    );
  }

  deleteChapter(id: string) {
    const project = this.state.project;
    if (project.chapters.length <= 1) { this.toast('至少要保留一个章节', 'warn'); return; }
    const fallback = project.chapters.find(c => c.id !== id);
    this.update(p => ({
      ...p,
      chapters: p.chapters.filter(c => c.id !== id),
      lines: p.lines.filter(l => l.chapterId !== id),
    }), '删除章节（含该章台词）');
    if (fallback) this.select('chapter', fallback.id);
  }

  moveChapter(id: string, delta: number) {
    this.update((project) => {
      const chapters = [...project.chapters];
      const from = chapters.findIndex(c => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= chapters.length) return project;
      const [item] = chapters.splice(from, 1);
      chapters.splice(to, 0, item);
      // 台词按章节顺序重排，保证阅读顺序与章节目录一致
      const ordered: Line[] = [];
      chapters.forEach(c => project.lines.filter(l => l.chapterId === c.id).forEach(l => ordered.push(l)));
      project.lines.filter(l => !chapters.some(c => c.id === l.chapterId)).forEach(l => ordered.push(l));
      return { ...project, chapters, lines: ordered };
    }, '调整章节顺序');
  }

  /* ------------------------------------------------------------------ 角色 */

  addCharacter() {
    const character: Character = { id: uid('char'), name: '新角色', nameEn: '', slot: 'left', expressions: [] };
    this.update(p => ({ ...p, characters: [...p.characters, character] }), '新增角色');
    this.select('character', character.id);
    this.setView('cast');
    return character;
  }

  updateCharacter(id: string, patch: Partial<Character>, label = '修改角色') {
    this.update(
      project => ({ ...project, characters: project.characters.map(c => (c.id === id ? { ...c, ...patch } : c)) }),
      label,
      { mergeKey: `character:${id}:${Object.keys(patch).sort().join(',')}` },
    );
  }

  deleteCharacter(id: string) {
    this.update(p => ({
      ...p,
      characters: p.characters.filter(c => c.id !== id),
      lines: p.lines.map(l => (l.speakerId === id ? { ...l, speakerId: null } : l)),
    }), '删除角色');
    const next = this.state.project.characters[0];
    if (next) this.select('character', next.id);
  }

  addExpression(characterId: string, assetId: string, assetName: string, autoSwitch = true) {
    const expression: Expression = {
      id: uid('exp'), label: assetName.replace(/\.[a-z0-9]+$/i, '').slice(0, 12), assetId,
      keyOut: true, keyColor: '#ff00ff', tolerance: 110, edgeOnly: false,
    };
    this.update(p => ({
      ...p,
      characters: p.characters.map(c => (c.id === characterId ? { ...c, expressions: [...c.expressions, expression] } : c)),
    }), '添加表情');
    if (autoSwitch) this.select('expression', expression.id);
    return expression;
  }

  updateExpression(characterId: string, expressionId: string, patch: Partial<Expression>) {
    this.update(p => ({
      ...p,
      characters: p.characters.map(c => (c.id === characterId
        ? { ...c, expressions: c.expressions.map(e => (e.id === expressionId ? { ...e, ...patch } : e)) }
        : c)),
    }), '修改表情', {
      silent: patch.label !== undefined,
      mergeKey: `expression:${expressionId}:${Object.keys(patch).sort().join(',')}`,
    });
  }

  deleteExpression(characterId: string, expressionId: string) {
    this.update(p => ({
      ...p,
      characters: p.characters.map(c => (c.id === characterId
        ? { ...c, expressions: c.expressions.filter(e => e.id !== expressionId) }
        : c)),
      lines: p.lines.map(l => (l.expressionId === expressionId ? { ...l, expressionId: '' } : l)),
    }), '删除表情');
  }

  /* ------------------------------------------------------------------ 素材 */

  addAssets(assets: Asset[], selectFirst = true) {
    this.update(p => ({ ...p, assets: [...p.assets, ...assets] }), `导入 ${assets.length} 个素材`);
    if (selectFirst && assets[0]) this.select('asset', assets[0].id);
    return assets;
  }

  updateAsset(id: string, patch: Partial<Asset>) {
    this.update(
      p => ({ ...p, assets: p.assets.map(a => (a.id === id ? { ...a, ...patch } : a)) }),
      '修改素材',
      { mergeKey: `asset:${id}:${Object.keys(patch).sort().join(',')}` },
    );
  }

  assetUsage(id: string) {
    const project = this.state.project;
    let count = 0;
    project.chapters.forEach(c => { if (c.backgroundId === id) count += 1; if (c.ambienceAssetId === id) count += 1; });
    project.lines.forEach(l => { if (l.cgAssetId === id) count += 1; });
    project.characters.forEach(c => c.expressions.forEach(e => { if (e.assetId === id) count += 1; }));
    return count;
  }

  deleteAsset(id: string) {
    const removedExpressions = new Set(this.state.project.characters.flatMap(c =>
      c.expressions.filter(e => e.assetId === id).map(e => e.id)));
    this.update(p => ({
      ...p,
      assets: p.assets.filter(a => a.id !== id),
      chapters: p.chapters.map(c => ({
        ...c,
        backgroundId: c.backgroundId === id ? '' : c.backgroundId,
        ambienceAssetId: c.ambienceAssetId === id ? '' : c.ambienceAssetId,
      })),
      lines: p.lines.map(l => ({
        ...l,
        cgAssetId: l.cgAssetId === id ? '' : l.cgAssetId,
        expressionId: removedExpressions.has(l.expressionId) ? '' : l.expressionId,
      })),
      characters: p.characters.map(c => ({ ...c, expressions: c.expressions.filter(e => e.assetId !== id) })),
    }), '删除素材');
  }

  /* ------------------------------------------------------------------ 主题 */

  setTheme(patch: Partial<Project['theme']>) {
    this.update(p => ({ ...p, theme: { ...p.theme, ...patch } }), '修改主题',
      { mergeKey: `theme:${Object.keys(patch).sort().join(',')}` });
  }

  setSettings(patch: Partial<Project['settings']>) {
    this.update(p => ({ ...p, settings: { ...p.settings, ...patch } }), '修改作品信息',
      { mergeKey: `settings:${Object.keys(patch).sort().join(',')}` });
  }

  setProjectMeta(patch: Partial<Project>) {
    this.update(p => ({ ...p, ...patch }), '修改作品信息',
      { mergeKey: `meta:${Object.keys(patch).sort().join(',')}` });
  }

  countsByKind(kind: AssetKind) {
    return this.state.project.assets.filter(a => a.kind === kind).length;
  }

  cloneProject(): Project {
    return deepClone(this.state.project);
  }
}

export const store = new Store();

// 方便在控制台 / 自动化测试里检查内部状态（体积可忽略）
if (typeof window !== 'undefined') {
  (window as unknown as { __galStore?: Store }).__galStore = store;
}

export function useStore<T>(selector: (state: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useProject(): Project {
  return useStore(s => s.project);
}

export function useSelection(): Selection {
  return useStore(s => s.selection);
}
