/* ============================================================================
 * Galgame Studio · 数据模型
 * 一个「项目」就是一份自包含的 JSON：素材以 dataURL 或相对路径存在 assets 里，
 * 因此项目文件可以单独保存、单独发送、单独打开。
 * ========================================================================== */

export type AssetKind = 'background' | 'sprite' | 'cg' | 'audio';
export type Presentation = 'sprite' | 'background' | 'cg';
export type Slot = 'left' | 'center' | 'right';
export type ThemePreset = 'backrooms' | 'midnight' | 'sakura' | 'noir' | 'paper' | 'coast' | 'neon' | 'winter';

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** dataURL（用户上传）或相对/绝对 URL（内置示例素材） */
  src: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface Expression {
  id: string;
  label: string;
  assetId: string;
  /** 自动去除纯色背景 */
  keyOut: boolean;
  keyColor: string;
  tolerance: number;
  /** 只清除与画面边缘连通的部分（保护角色身上与背景同色的区域） */
  edgeOnly?: boolean;
}

export interface Character {
  id: string;
  name: string;
  nameEn: string;
  slot: Slot;
  expressions: Expression[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  level: string;
  location: string;
  backgroundId: string;
  /** 章节氛围色（叠加在场景图上的柔光） */
  tint: string;
  tintStrength: number;
  ambienceLabel: string;
  ambienceFreqs: number[];
  ambienceAssetId: string;
}

export interface Line {
  id: string;
  chapterId: string;
  /** null = 旁白 */
  speakerId: string | null;
  text: string;
  expressionId: string;
  presentation: Presentation;
  cgAssetId: string;
}

export interface Theme {
  preset: ThemePreset;
  accent: string;
  accentInk: string;
  font: 'serif' | 'sans';
  radius: number;
  dialogOpacity: number;
  spriteScale: number;
  grain: boolean;
  dust: boolean;
  motion: boolean;
  veil: 'on' | 'soft' | 'off';
  align: 'left' | 'center';
  layout: 'bottom' | 'wide';
  tintStrength: number;
}

export interface ProjectSettings {
  saves: number;
  titleScreen: boolean;
  sideNote: string;
  sideNoteSub: string;
  connectionLabel: string;
  progressLabel: string;
  endingTitle: string;
  endingEyebrow: string;
  endingText: string;
  endingThanks: string;
  endingFootnote: string;
  titleTagline: string;
  chaptersFootnote: string;
  narratorLabel: string;
}

export interface Project {
  id: string;
  version: number;
  title: string;
  subtitle: string;
  author: string;
  tagline: string;
  description: string;
  theme: Theme;
  settings: ProjectSettings;
  assets: Asset[];
  characters: Character[];
  chapters: Chapter[];
  lines: Line[];
}

/* ------------------------------------------------------------------ 工具 */

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function deepClone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export const SLOT_LABEL: Record<Slot, string> = { left: '左侧', center: '中间', right: '右侧' };
export const PRESENTATION_LABEL: Record<Presentation, string> = { sprite: '立绘', background: '纯背景', cg: '事件 CG' };
export const KIND_LABEL: Record<AssetKind, string> = { background: '背景', sprite: '立绘', cg: '事件 CG', audio: '音频' };

/* ------------------------------------------------------------- 主题预设 */

export interface ThemeSwatch {
  id: ThemePreset;
  name: string;
  hint: string;
  colors: { bg: string; accent: string; ink: string; panel: string };
  theme: Partial<Theme>;
}

export const THEME_PRESETS: ThemeSwatch[] = [
  {
    id: 'coast', name: '海风来信', hint: '晴空、白色站台与青绿色海面',
    colors: { bg: '#edf6f7', accent: '#167c83', ink: '#183c45', panel: '#f5fcfd' },
    theme: { preset: 'coast', accent: '#167c83', accentInk: '#ffffff', radius: 6, dialogOpacity: 94, grain: false, dust: false, font: 'sans', veil: 'soft' },
  },
  {
    id: 'neon', name: '雨夜霓虹', hint: '珊瑚红与青色灯光，城市悬疑',
    colors: { bg: '#151519', accent: '#ff8c96', ink: '#f2f4f5', panel: '#25232b' },
    theme: { preset: 'neon', accent: '#ff8c96', accentInk: '#29171e', radius: 0, dialogOpacity: 92, grain: true, dust: false, font: 'sans', veil: 'soft' },
  },
  {
    id: 'winter', name: '冬日书店', hint: '雪白书页、墨绿边框与红色书签',
    colors: { bg: '#f3f5f2', accent: '#a83c4c', ink: '#293a38', panel: '#ffffff' },
    theme: { preset: 'winter', accent: '#a83c4c', accentInk: '#ffffff', radius: 3, dialogOpacity: 97, grain: false, dust: false, font: 'serif', veil: 'off' },
  },
  {
    id: 'backrooms', name: '后室青苔', hint: '原引擎默认质感：潮湿的绿，荧光灯下的安静',
    colors: { bg: '#171b14', accent: '#c2d1bc', ink: '#eeeae0', panel: '#122520' },
    theme: { preset: 'backrooms', accent: '#c2d1bc', accentInk: '#233d32', radius: 3, dialogOpacity: 90 },
  },
  {
    id: 'midnight', name: '深夜蓝', hint: '适合悬疑、城市、雨夜',
    colors: { bg: '#0d1420', accent: '#a9c3e6', ink: '#e8eef7', panel: '#141f31' },
    theme: { preset: 'midnight', accent: '#a9c3e6', accentInk: '#16273d', radius: 4, dialogOpacity: 88 },
  },
  {
    id: 'sakura', name: '樱色', hint: '适合校园、恋爱、日常',
    colors: { bg: '#1d1418', accent: '#f0b3c4', ink: '#fdeef2', panel: '#2b1a22' },
    theme: { preset: 'sakura', accent: '#f0b3c4', accentInk: '#48202c', radius: 8, dialogOpacity: 86 },
  },
  {
    id: 'noir', name: '黑白无衬线', hint: '极简、硬朗，适合短篇与实验作',
    colors: { bg: '#141414', accent: '#d9d9d9', ink: '#f4f4f4', panel: '#1e1e1e' },
    theme: { preset: 'noir', accent: '#d9d9d9', accentInk: '#1a1a1a', radius: 0, dialogOpacity: 92 },
  },
  {
    id: 'paper', name: '羊皮纸', hint: '浅色底、书页感，适合文字向作品',
    colors: { bg: '#efe7d8', accent: '#8a6a45', ink: '#3a2f24', panel: '#fbf5e9' },
    theme: { preset: 'paper', accent: '#8a6a45', accentInk: '#fdf9f0', radius: 2, dialogOpacity: 94 },
  },
];

export function defaultTheme(): Theme {
  return {
    preset: 'backrooms',
    accent: '#c2d1bc',
    accentInk: '#233d32',
    font: 'serif',
    radius: 3,
    dialogOpacity: 90,
    spriteScale: 1,
    grain: true,
    dust: true,
    motion: true,
    veil: 'on',
    align: 'left',
    layout: 'bottom',
    tintStrength: 0.75,
  };
}

export function defaultSettings(): ProjectSettings {
  return {
    saves: 6,
    titleScreen: true,
    sideNote: 'A VISUAL NOVEL',
    sideNoteSub: 'OUR STORY',
    connectionLabel: '与你相连',
    progressLabel: '',
    endingTitle: '故事到这里。',
    endingEyebrow: 'THE END',
    endingText: '谢谢你把这段故事读完。<br />下一次，我们还会再见。',
    endingThanks: '感谢游玩',
    endingFootnote: '',
    titleTagline: '一段由你写下的相遇。',
    chaptersFootnote: '点击任意已解锁的章节即可跳转',
    narratorLabel: '旁白',
  };
}

/* ------------------------------------------------------------- 空白项目 */

export function blankProject(title = '我的第一部视觉小说'): Project {
  const chapterId = uid('ch');
  const characterId = uid('char');
  return {
    id: uid('proj'),
    version: 1,
    title,
    subtitle: 'A VISUAL NOVEL',
    author: '',
    tagline: '一段由你写下的相遇。',
    description: '',
    theme: defaultTheme(),
    settings: defaultSettings(),
    assets: [],
    characters: [
      {
        id: characterId,
        name: '主角',
        nameEn: '',
        slot: 'right',
        expressions: [],
      },
    ],
    chapters: [
      {
        id: chapterId,
        number: '01',
        title: '第一章 · 相遇',
        subtitle: '故事，从这里开始。',
        description: '写下这一章的简介。',
        level: 'SCENE 01',
        location: '地点',
        backgroundId: '',
        tint: '',
        tintStrength: 0.75,
        ambienceLabel: '安静的房间',
        ambienceFreqs: [55, 110, 164.8, 220.3],
        ambienceAssetId: '',
      },
    ],
    lines: [
      {
        id: uid('ln'),
        chapterId,
        speakerId: null,
        text: '（这是第一句旁白。点击这一行，在右侧修改文字。）',
        expressionId: '',
        presentation: 'background',
        cgAssetId: '',
      },
      {
        id: uid('ln'),
        chapterId,
        speakerId: characterId,
        text: '你好，我是这部作品的主角。',
        expressionId: '',
        presentation: 'sprite',
        cgAssetId: '',
      },
    ],
  };
}

/** 把项目补齐到当前版本的完整结构（打开旧文件 / 手改 JSON 时兜底） */
export function normalizeProject(input: Partial<Project> | null | undefined): Project {
  const base = blankProject();
  const project: Project = {
    ...base,
    ...(input || {}),
    theme: { ...base.theme, ...((input && input.theme) || {}) },
    settings: { ...base.settings, ...((input && input.settings) || {}) },
    assets: (input && input.assets) || [],
    characters: (input && input.characters) || base.characters,
    chapters: (input && input.chapters) || [],
    lines: (input && input.lines) || base.lines,
    version: 1,
  };
  if (!project.chapters.length) project.chapters = base.chapters;
  // 修正悬空引用，避免小白误删素材后整部作品打不开
  const assetIds = new Set(project.assets.map(a => a.id));
  const chapterIds = new Set(project.chapters.map(c => c.id));
  const characterIds = new Set(project.characters.map(c => c.id));
  project.chapters = project.chapters.map(c => ({ ...c, backgroundId: assetIds.has(c.backgroundId) ? c.backgroundId : '' }));
  project.lines = project.lines.map(l => ({
    ...l,
    chapterId: chapterIds.has(l.chapterId) ? l.chapterId : project.chapters[0].id,
    speakerId: l.speakerId && characterIds.has(l.speakerId) ? l.speakerId : null,
    cgAssetId: l.cgAssetId && assetIds.has(l.cgAssetId) ? l.cgAssetId : '',
  }));
  return project;
}

/* ------------------------------------------------------------------ 统计 */

export function projectStats(project: Project) {
  const chars = project.lines.reduce((sum, l) => sum + (l.text || '').length, 0);
  const bytes = project.assets.reduce((sum, a) => sum + (a.bytes || Math.round((a.src || '').length * 0.75)), 0);
  return { lines: project.lines.length, chapters: project.chapters.length, characters: project.characters.length, assets: project.assets.length, chars, bytes };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
