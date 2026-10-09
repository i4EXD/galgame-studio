/* ============================================================================
 * 内置示例项目：《与你，坠入》—— 原作完整内容（3 章 · 55 句）
 * 打开编辑器时第一次看到的就是它：可以直接点「播放」体验，
 * 也可以在它的基础上改成自己的故事。
 * ========================================================================== */

/* 示例素材在构建期被烘焙成 WebP dataURL（见 tools/_bake-assets.mjs）：
   这样编辑器是真正的单文件，file:// 下双击打开也能正常抠图立绘。 */
import demoAssetsRaw from './demo-assets.json?raw';
import { defaultSettings, defaultTheme, uid, type Project, type ProjectSettings, type Expression, type Chapter, type Line, type Asset } from './types';

interface BakedAsset { src: string; width: number; height: number; bytes: number }
const DEMO_ASSETS = JSON.parse(demoAssetsRaw) as Record<string, BakedAsset>;

const assetDefs: [string, string, Asset['kind'], string][] = [
  ['bg-level0', '无尽大厅（荧光灯）', 'background', 'empty-level-zero.jpg'],
  ['bg-pool', '泳池房间（深蓝）', 'background', 'poolrooms.jpg'],
  ['bg-station', '无名车站（黎明）', 'background', 'last-station.jpg'],
  ['cg-promise', '事件 CG · 约定', 'cg', 'nozomi-promise-cg.jpg'],
  ['sp-gentle', 'nozomi · 温柔', 'sprite', 'nozomi-gentle.png'],
  ['sp-worried', 'nozomi · 担忧', 'sprite', 'nozomi-worried.png'],
  ['sp-resolute', 'nozomi · 坚定', 'sprite', 'nozomi-resolute.png'],
  ['sp-blush', 'nozomi · 害羞', 'sprite', 'nozomi-blush.png'],
];

export const DEMO_NOZOMI = 'char-nozomi';
export const DEMO_YUMA = 'char-yuma';
export const DEMO_CHAPTERS = ['ch-level0', 'ch-pool', 'ch-station'];

const expressions: Expression[] = [
  { id: 'gentle', label: '温柔', assetId: 'sp-gentle', keyOut: true, keyColor: '#ff00ff', tolerance: 110, edgeOnly: false },
  { id: 'worried', label: '担忧', assetId: 'sp-worried', keyOut: true, keyColor: '#ff00ff', tolerance: 110, edgeOnly: false },
  { id: 'resolute', label: '坚定', assetId: 'sp-resolute', keyOut: true, keyColor: '#ff00ff', tolerance: 110, edgeOnly: false },
  { id: 'blush', label: '害羞', assetId: 'sp-blush', keyOut: true, keyColor: '#ff00ff', tolerance: 110, edgeOnly: false },
];

const chapters: Chapter[] = [
  {
    id: DEMO_CHAPTERS[0], number: '01', title: '荧光灯下的初遇',
    subtitle: '在世界的缝隙里，\n与你相遇。',
    description: '有些相遇，是迷失的开始。',
    level: 'LEVEL 0', location: '无尽大厅', backgroundId: 'bg-level0',
    tint: '#7fa88c', tintStrength: 0.55,
    ambienceLabel: '荧光灯的低语', ambienceFreqs: [55, 110, 164.8, 220.3], ambienceAssetId: '',
  },
  {
    id: DEMO_CHAPTERS[1], number: '02', title: '倒映着你的深蓝',
    subtitle: '如果深水没有尽头，\n就握紧我的手。',
    description: '你的声音，是我唯一的方向。',
    level: 'LEVEL 37', location: '泳池房间', backgroundId: 'bg-pool',
    tint: '#4f86c6', tintStrength: 0.6,
    ambienceLabel: '深蓝色的寂静', ambienceFreqs: [49, 98, 146.8, 196], ambienceAssetId: '',
  },
  {
    id: DEMO_CHAPTERS[2], number: '03', title: '世界尽头的约定',
    subtitle: '在黎明抵达之前，\n我们不再走散。',
    description: '回家的路，也可以是一个人的名字。',
    level: 'LEVEL ???', location: '无名车站', backgroundId: 'bg-station',
    tint: '#e0a878', tintStrength: 0.5,
    ambienceLabel: '黎明之前', ambienceFreqs: [65.4, 130.8, 196, 261.6], ambienceAssetId: '',
  },
];

type Raw = [string, string, string, string, Line['presentation']?];

const raw: Raw[] = [
  ['nozomi', '……太好了。\n这里，终于不只有我一个人了。', 'gentle', 'sprite'],
  ['narrator', '女孩的声音穿过荧光灯的嗡鸣。浅绿的长发垂在格纹披肩上，精灵般的尖耳轻轻动了一下。她抬起金色的眼睛，像终于找到了岸。', 'gentle', 'sprite'],
  ['yuma', '你也是……从原来的世界掉进来的吗？我刚刚还在地铁站，下一步却踩空了。', 'gentle', 'sprite'],
  ['nozomi', '嗯。我推开画室的门，就到了这里。手机停在凌晨两点十七分，再也没动过。', 'worried', 'sprite'],
  ['narrator', '我的屏幕上，也是 02:17。她头顶的环状微光映在屏幕边缘。这个地方，连「真实」都变得难以分辨。', 'worried', 'sprite'],
  ['nozomi', '我叫 nozomi。是「希望」的意思。……如果你是真的，可以告诉我你的名字吗？', 'gentle', 'sprite'],
  ['yuma', '悠真。你看，我有影子，也有体温。至少现在，我们都是真的。', 'gentle', 'sprite'],
  ['narrator', '她小心地碰了碰我伸出的手。指尖冰凉，脸颊却泛起了淡淡的红。身后的黑色细尾悄悄蜷起，我没有收回手。', 'blush', 'sprite'],
  ['nozomi', '我在墙上见过留言。他们把这里叫作「后室」。潮湿的地毯、重复的房间……还有，最好不要回应的声音。', 'worried', 'sprite'],
  ['narrator', '远处忽然传来呼唤。是母亲的声音。她已经去世三年，却在走廊尽头叫我回家。', 'worried', 'sprite'],
  ['yuma', '……妈？', 'worried', 'sprite'],
  ['nozomi', '别过去！看着我，悠真。那不是她。你刚刚告诉我的名字，再说一遍，好吗？', 'resolute', 'sprite'],
  ['narrator', 'nozomi 用力拉住我。门后的声音戛然而止，一根过长的黑色手指，缓缓缩回门缝。', 'resolute', 'sprite'],
  ['yuma', '悠真。我叫悠真。……谢谢你，nozomi。', 'gentle', 'sprite'],
  ['nozomi', '我们约定一件事吧。以后，不管听见什么，都先确认彼此的手还在。', 'resolute', 'sprite'],
  ['narrator', '我们在墙上画下两颗并排的星星，作为走过这里的记号。第三次转弯后，星星不见了，墙后却传来水声。', 'gentle', 'sprite'],
  ['nozomi', '这面墙……像水一样。你害怕吗？', 'worried', 'sprite'],
  ['yuma', '害怕。不过这次，我们一起。', 'gentle', 'sprite'],

  ['narrator', '失重只持续了一瞬。再睁眼时，暖黄的房间已变成无边的蓝。瓷砖、拱门，和一片没有涟漪的水。', 'worried', 'background'],
  ['nozomi', '这里安静得……连心跳都像不该出现的声音。', 'worried', 'sprite'],
  ['yuma', '先沿着浅水走。台阶上有字：Level 37。下面那一句被水泡掉了。', 'worried', 'sprite'],
  ['narrator', 'nozomi 蹲下来，用画笔描出残留的刻痕。「不要追随倒影。」最后一个字下面，有五道深深的抓痕。', 'worried', 'background'],
  ['nozomi', '我以前总画海，却从来不敢下水。小时候溺过一次水。是不是很没出息？', 'worried', 'sprite'],
  ['yuma', '不。害怕的时候，还愿意向前走，已经很勇敢了。你刚才也是这样救我的。', 'blush', 'sprite'],
  ['narrator', '她笑了一下。水中的倒影却没有笑。它抬起头，先于她一步，向我伸出了手。', 'gentle', 'sprite'],
  ['yuma', 'nozomi，离开水边！', 'worried', 'sprite'],
  ['narrator', '瓷砖在她脚下无声地塌陷。那片看似及踝的浅水，将她整个吞没。我的手里只剩下一截浅蓝色的缎带。', 'worried', 'background'],
  ['narrator', '我跳了下去。水下没有池底，只有无数扇敞开的门，每扇门后，都站着一个 nozomi。', 'worried', 'background'],
  ['nozomi', '……悠真。不要看她们。', 'worried', 'background'],
  ['narrator', '声音从身后传来，微弱得几乎听不见。我闭上眼睛，向那个声音伸出手。熟悉的冰凉指尖，终于触到了我。', 'worried', 'background'],
  ['yuma', '抓住了。这次，轮到我救你。', 'worried', 'background'],
  ['narrator', '我们跌回岸边，大口喘息。nozomi 没有哭，只是一直攥着我的手，直到指节都失去了颜色。', 'worried', 'sprite'],
  ['nozomi', '水里的东西说，只要留下你，就让我回家。我……差一点就相信了。', 'worried', 'sprite'],
  ['yuma', '可你还是叫了我的名字。那就够了。', 'blush', 'sprite'],
  ['nozomi', '悠真，出去以后，可以陪我去看看真正的海吗？不是倒影。也不是画里的。', 'blush', 'sprite'],
  ['yuma', '好。去有风、有海鸥，还有卖难吃冰淇淋的小店的那种海。', 'gentle', 'sprite'],
  ['narrator', 'nozomi 终于笑出声，露出一点小小的尖牙。那一刻，远处封闭的拱门里亮起一线晨光。像这个世界，也短暂地相信了我们的约定。', 'gentle', 'sprite'],

  ['narrator', '拱门的另一端，是一座没有名字的车站。时钟仍停在 02:17，天边却泛起薄薄的粉色。', 'gentle', 'background'],
  ['nozomi', '这里……和我小时候回家的车站一模一样。连长椅上的裂缝都在。', 'gentle', 'sprite'],
  ['yuma', '可它也是我下班会经过的车站。我们明明住在不同的城市。', 'worried', 'sprite'],
  ['narrator', '广播响起。没有人声，只有一段仿佛从记忆深处传来的旋律。售票窗口缓缓吐出一张车票。', 'worried', 'sprite'],
  ['nozomi', '「单人乘车。另一人将成为本站的回声。」……为什么只有一张？', 'worried', 'sprite'],
  ['narrator', '轨道尽头亮起车灯。nozomi 低下头，将车票塞进我的掌心，然后悄悄松开了手。', 'worried', 'sprite'],
  ['nozomi', '你答应过带我去看海。如果我出不去……就替我看看吧。', 'worried', 'sprite'],
  ['yuma', '不行。我们的约定里，没有「替你」。', 'worried', 'sprite'],
  ['narrator', '我把那张票撕成两半。风突然停了。列车的灯光像眼睛一样睁大，站台后的阴影朝我们涌来。', 'resolute', 'sprite'],
  ['nozomi', '悠真！墙上——你看！', 'resolute', 'sprite'],
  ['narrator', '剥落的站牌背后，露出两颗并排的小星星。和我们留在第一层的记号一模一样。', 'resolute', 'sprite'],
  ['yuma', '它一直在骗我们。这里不是出口……是让我们分开的最后一个房间。', 'resolute', 'sprite'],
  ['nozomi', '那就像第一次一样。别听它的，看着我。', 'resolute', 'sprite'],
  ['narrator', '她重新握住我的手，向我靠近。荧光灯的嗡鸣、深水的回声、列车的轰响，都慢慢退到很远的地方。', 'blush', 'cg'],
  ['nozomi', '我喜欢你，悠真。不是因为这里只有你。是因为，就算回到有无数人的世界，我也想找到你。', 'blush', 'cg'],
  ['yuma', '我会让你找到的。不过现在……别放手。', 'blush', 'cg'],
  ['narrator', '我们一起走向星星所在的墙。没有撞击，也没有坠落。只有清晨的风，和远处面包店刚刚开门的铃铛声。', 'gentle', 'background'],
  ['nozomi', '……两点十八分。悠真，时间开始走了。', 'gentle', 'sprite'],
  ['narrator', '她站在晨光里，浅绿的长发被风轻轻吹起，金色的眼睛里映着黎明。我握着她的手，像握着终于失而复得的整个世界。', 'blush', 'sprite'],
  ['yuma', '走吧，nozomi。我们去看海。', 'gentle', 'sprite'],
  ['narrator', '后来，我们再也没有找到那座车站。\n可每当世界变得陌生，我知道，只要伸出手——她就在那里。', 'gentle', 'background'],
];

const speakerMap: Record<string, string | null> = { nozomi: DEMO_NOZOMI, yuma: DEMO_YUMA, narrator: null };

const lines: Line[] = raw.map(([speaker, text, expression, presentation], i) => {
  // 原作按顺序推进：第 19 句起进入第二章，第 37 句起进入第三章
  const chapterId = i < 18 ? DEMO_CHAPTERS[0] : i < 37 ? DEMO_CHAPTERS[1] : DEMO_CHAPTERS[2];
  return {
    id: `ln-demo-${i + 1}`,
    chapterId,
    speakerId: speakerMap[speaker],
    text,
    expressionId: expression,
    presentation: presentation || 'sprite',
    cgAssetId: presentation === 'cg' ? 'cg-promise' : '',
  } as Line;
});

export function demoProject(): Project {
  const assets: Asset[] = assetDefs.map(([id, name, kind, file]) => {
    const baked = DEMO_ASSETS[file];
    return {
      id, name, kind,
      src: baked ? baked.src : '',
      width: baked ? baked.width : undefined,
      height: baked ? baked.height : undefined,
      bytes: baked ? baked.bytes : undefined,
    };
  });
  const settings: ProjectSettings = {
    ...defaultSettings(),
    saves: 6,
    titleScreen: true,
    sideNote: 'THE BACKROOMS',
    sideNoteSub: 'OUR STORY',
    connectionLabel: '与你相连',
    progressLabel: '一场没有选项的相遇',
    endingTitle: '彼此，就是出口。',
    endingEyebrow: 'TRUE END · 与你，归来',
    endingText: '我们没能记住走出后室的路。<br />但我们记住了，彼此的名字。',
    endingThanks: '感谢你，陪 nozomi 与悠真走到这里。',
    endingFootnote: '全三章 · 故事已完结',
    titleTagline: '一场没有选项的相遇。<br />但每一个字，都通向出口。',
    chaptersFootnote: '线性叙事 · 无选择分支 · 约 15 分钟阅读体验',
  };
  return {
    id: 'proj-demo-backrooms',
    version: 1,
    title: '与你，坠入',
    subtitle: 'LOST, WITH YOU',
    author: 'Galgame Studio · 示例作品',
    tagline: '在世界的缝隙里，与你相遇。',
    description: '一部关于迷失、勇气与爱的原创视觉小说，基于后室世界观的虚构故事。',
    theme: { ...defaultTheme(), preset: 'backrooms', accent: '#c2d1bc', accentInk: '#233d32', radius: 3, spriteScale: 1 },
    settings,
    assets,
    characters: [
      { id: DEMO_NOZOMI, name: 'nozomi', nameEn: 'WITH YOU', slot: 'right', expressions },
      { id: DEMO_YUMA, name: '悠真', nameEn: 'YUMA', slot: 'right', expressions: [] },
    ],
    chapters,
    lines,
  };
}

/* ---------------------------------------------------------- 新手教学模板 */

export function starterProject(): Project {
  const chapterId = uid('ch');
  const heroId = uid('char');
  return {
    id: uid('proj'),
    version: 1,
    title: '我的第一部视觉小说',
    subtitle: 'MY FIRST VISUAL NOVEL',
    author: '',
    tagline: '三分钟就能读到的开场。',
    description: '',
    theme: defaultTheme(),
    settings: defaultSettings(),
    assets: [],
    characters: [
      { id: heroId, name: '小夏', nameEn: 'NATSU', slot: 'right', expressions: [] },
    ],
    chapters: [
      {
        id: chapterId, number: '01', title: '第一章 · 开场',
        subtitle: '故事，从这里开始。', description: '这一章会教你编辑器怎么用。',
        level: 'SCENE 01', location: '放学后的教室', backgroundId: '',
        tint: '', tintStrength: 0.75,
        ambienceLabel: '安静的教室', ambienceFreqs: [55, 110, 164.8, 220.3], ambienceAssetId: '',
      },
    ],
    lines: [
      { id: uid('ln'), chapterId, speakerId: null, text: '欢迎来到 Galgame Studio！\n这部小作品由 6 句话组成，读完之后你就知道怎么做了。', expressionId: '', presentation: 'background', cgAssetId: '' },
      { id: uid('ln'), chapterId, speakerId: heroId, text: '这一句是「角色台词」。\n在右侧把说话人换成你的人物，文字换成你想说的话。', expressionId: '', presentation: 'sprite', cgAssetId: '' },
      { id: uid('ln'), chapterId, speakerId: null, text: '这一句是「旁白」。旁白没有名字牌，适合写场景和心里话。', expressionId: '', presentation: 'sprite', cgAssetId: '' },
      { id: uid('ln'), chapterId, speakerId: heroId, text: '在「素材」里上传一张背景图，回到这一行，\n把「背景」指向它——场景就出现了。', expressionId: '', presentation: 'sprite', cgAssetId: '' },
      { id: uid('ln'), chapterId, speakerId: heroId, text: '在「角色」里上传几张立绘（不同表情），\n指定给这一行，人物就会站到画面里。', expressionId: '', presentation: 'sprite', cgAssetId: '' },
      { id: uid('ln'), chapterId, speakerId: null, text: '最后点右上角的「发布」，导出成一个单独的 HTML 文件——\n把它发给任何人，双击就能玩。\n\n现在，开始写你自己的故事吧。', expressionId: '', presentation: 'sprite', cgAssetId: '' },
    ],
  };
}
