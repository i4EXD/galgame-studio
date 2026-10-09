import artAssetsRaw from './art-assets.json?raw';
import { blankProject, THEME_PRESETS, uid, type Project } from './types';
const artAssets = JSON.parse(artAssetsRaw) as Record<string, { src: string }>;
const coastImage = artAssets['coast.png'].src;
const neonImage = artAssets['neon.png'].src;
const winterImage = artAssets['winter.png'].src;

export const ART_TEMPLATES = [
  { id: 'coast', title: '海风来信', subtitle: 'LETTERS BY THE SEA', image: coastImage, location: '海边小站',
    hint: '海边小站 · 青绿晴空 · 重逢短篇', character: '夏澄',
    lines: ['列车驶离后，站台只剩下潮水的声音。', '你还是和从前一样，喜欢坐在最后一节车厢。', '她把一封信放在长椅上。信封已经被海风吹得有些发白。', '这封信，我每个夏天都带来。', '如果今天我没有回来呢？', '那就等下一个夏天。可是你看，你来了。'],
  },
  { id: 'neon', title: '雨夜霓虹', subtitle: 'AFTER THE LAST RAIN', image: neonImage, location: '深夜洗衣店',
    hint: '雨夜街巷 · 红青霓虹 · 都市悬疑', character: '凛',
    lines: ['末班车已经开走，洗衣店的灯却还亮着。', '你有没有发现，这条街没有倒影？', '我低下头。水面里只有霓虹，和一把无人撑起的伞。', '别回头。先数到三，再跟我进店。', '你为什么会知道我的名字？', '因为昨晚，也是你问了这句话。'],
  },
  { id: 'winter', title: '冬日书店', subtitle: 'A BOOKMARK IN WINTER', image: winterImage, location: '街角书店',
    hint: '雪天书店 · 白纸墨绿 · 温暖日常', character: '知雪',
    lines: ['雪落在街角。书店里，旧书页的声音比钟声还轻。', '欢迎回来。你借的那本书，我还没有放回架子。', '桌上摊着一本诗集，红色书签停在最后一页。', '这次，想读一个怎样的结局？', '一个不会因为冬天结束，就让人走散的结局。', '那我们从第一页重新开始吧。'],
  },
] as const;

export type ArtTemplateId = typeof ART_TEMPLATES[number]['id'];

export function artProject(id: ArtTemplateId): Project {
  const template = ART_TEMPLATES.find(item => item.id === id)!;
  const project = blankProject(template.title);
  const chapter = project.chapters[0];
  const character = project.characters[0];
  const assetId = uid('bg');
  project.subtitle = template.subtitle;
  project.tagline = template.lines[0];
  project.description = template.hint;
  project.theme = { ...project.theme, ...THEME_PRESETS.find(preset => preset.id === id)!.theme };
  project.settings.titleTagline = template.lines[0];
  project.settings.endingTitle = '下一页，留给我们。';
  project.settings.endingText = '故事的开场已经写下。<br />余下的时光，由你续写。';
  project.settings.sideNote = template.subtitle;
  project.assets = [{ id: assetId, name: template.location, kind: 'background', src: template.image }];
  character.name = template.character;
  chapter.title = '第一章 · 重逢';
  chapter.subtitle = template.lines[0];
  chapter.description = template.hint;
  chapter.location = template.location;
  chapter.backgroundId = assetId;
  chapter.tint = '';
  chapter.ambienceLabel = template.location;
  project.lines = template.lines.map((text, index) => ({
    id: uid('ln'), chapterId: chapter.id, text,
    speakerId: [1, 3, 5].includes(index) ? character.id : null,
    expressionId: '', presentation: 'background', cgAssetId: '',
  }));
  return project;
}
