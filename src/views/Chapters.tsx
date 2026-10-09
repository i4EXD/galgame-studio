/* 章节视图：一章 = 一段场景（背景 + 氛围 + 标题） */
import { store, useProject, useSelection } from '../store';
import type { Chapter } from '../types';
import { Btn, ColorInput, Empty, Field, Icon, Section, Select, Slider, TextArea, TextInput, Thumb } from '../ui';

export function ChaptersLeft() {
  const project = useProject();
  const selection = useSelection();
  return (
    <>
      <Section dense title="全部章节" hint={`${project.chapters.length} 章 · ${project.lines.length} 句台词`}
        actions={<Btn size="sm" icon="plus" kind="solid" onClick={() => store.addChapter()}>新增</Btn>}>
        <div className="gs-cardlist">
          {project.chapters.map((chapter, i) => {
            const background = project.assets.find(a => a.id === chapter.backgroundId);
            const count = project.lines.filter(l => l.chapterId === chapter.id).length;
            return (
              <button key={chapter.id} className={`gs-card ${chapter.id === selection.id && selection.kind === 'chapter' ? 'is-on' : ''}`}
                onClick={() => store.select('chapter', chapter.id)}>
                <Thumb src={background?.src} ratio={16 / 9} className="gs-card-thumb" fallback="image" />
                <span className="gs-card-body">
                  <span className="gs-card-no">CHAPTER {chapter.number || String(i + 1).padStart(2, '0')}</span>
                  <strong>{chapter.title || '未命名章节'}</strong>
                  <small>{(chapter.level ? `${chapter.level} · ` : '')}{chapter.location || '未填写地点'} · {count} 句</small>
                </span>
                <span className="gs-card-actions" onClick={e => e.stopPropagation()}>
                  <button title="上移" disabled={i === 0} onClick={() => store.moveChapter(chapter.id, -1)}><Icon name="up" size={13} /></button>
                  <button title="下移" disabled={i === project.chapters.length - 1} onClick={() => store.moveChapter(chapter.id, 1)}><Icon name="down" size={13} /></button>
                </span>
              </button>
            );
          })}
        </div>
      </Section>
      <p className="gs-side-note">章节顺序 = 阅读顺序。调整顺序时台词会一起跟着走。</p>
    </>
  );
}

export function ChapterInspector() {
  const project = useProject();
  const selection = useSelection();
  const chapter: Chapter | undefined = project.chapters.find(c => c.id === selection.id);

  if (!chapter) {
    return (
      <Section title="章节详情">
        <Empty title="还没有选中章节" hint="左边点一下任意一章。" />
      </Section>
    );
  }

  const backgrounds = project.assets.filter(a => a.kind === 'background' || a.kind === 'cg');
  const audios = project.assets.filter(a => a.kind === 'audio');
  const index = project.chapters.findIndex(c => c.id === chapter.id);
  const firstLine = project.lines.findIndex(l => l.chapterId === chapter.id);
  const patch = (changes: Partial<Chapter>, label?: string) => store.updateChapter(chapter.id, changes, label);

  return (
    <>
      <Section title={`第 ${index + 1} 章`} hint={`${project.lines.filter(l => l.chapterId === chapter.id).length} 句台词`}
        actions={<Btn size="sm" icon="play" kind="quiet" disabled={firstLine < 0} onClick={() => store.jumpPreview(firstLine)}>预览这一章</Btn>}>
        <Field label="章节编号" hint="会显示在右上角与章节卡上">
          <TextInput value={chapter.number} placeholder="01" onValue={value => patch({ number: value }, '修改章节编号')} />
        </Field>
        <Field label="章节标题">
          <TextInput value={chapter.title} placeholder="荧光灯下的初遇" onValue={value => patch({ title: value }, '修改章节标题')} />
        </Field>
        <Field label="副标题" hint="换行会分成两行大字">
          <TextArea value={chapter.subtitle} rows={2} placeholder={'在世界的缝隙里，\n与你相遇。'} onValue={value => patch({ subtitle: value }, '修改副标题')} />
        </Field>
        <Field label="章节简介">
          <TextInput value={chapter.description} placeholder="有些相遇，是迷失的开始。" onValue={value => patch({ description: value }, '修改章节简介')} />
        </Field>
        <Btn icon="copy" onClick={() => store.duplicateChapter(chapter.id)}>复制整章</Btn>
      </Section>

      <Section title="场景信息" hint="显示在左上角的层级标签">
        <div className="gs-row">
          <Field label="层级 / 幕" inline>
            <TextInput value={chapter.level} placeholder="LEVEL 0" onValue={value => patch({ level: value }, '修改层级')} />
          </Field>
          <Field label="地点" inline>
            <TextInput value={chapter.location} placeholder="无尽大厅" onValue={value => patch({ location: value }, '修改地点')} />
          </Field>
        </div>
        <Field label="章节背景图" hint={backgrounds.length ? '来自你的素材库' : '素材库里还没有背景图'}>
          <Select value={chapter.backgroundId} placeholder={backgrounds.length ? '不使用背景图' : '还没有背景素材'}
            onChange={value => patch({ backgroundId: value }, '修改背景图')}
            options={backgrounds.map(a => ({ value: a.id, label: a.name }))} />
        </Field>
        {chapter.backgroundId && (
          <Thumb src={project.assets.find(a => a.id === chapter.backgroundId)?.src} className="gs-bigthumb" />
        )}
        <Btn size="sm" icon="image" onClick={() => store.setView('assets')}>去素材库上传背景</Btn>
      </Section>

      <Section title="氛围色" hint="叠在背景上的一层柔光，用来区分章节气质">
        <Field label="颜色" hint="留空则不使用">
          <ColorInput value={chapter.tint} onChange={value => patch({ tint: value }, '修改氛围色')} />
        </Field>
        <Field label="强度">
          <Slider value={Math.round((chapter.tintStrength ?? 0.75) * 100)} min={10} max={100}
            format={v => `${v}%`} onChange={v => patch({ tintStrength: v / 100 }, '修改氛围色强度')} />
        </Field>
      </Section>

      <Section title="环境音" hint="不传音频也有合成氛围音，填标签即可">
        <Field label="环境音名称" hint="显示在左下角">
          <TextInput value={chapter.ambienceLabel} placeholder="荧光灯的低语" onValue={value => patch({ ambienceLabel: value }, '修改环境音名称')} />
        </Field>
        <Field label="合成音频率" hint="逗号分隔，越低越沉（55,110,164.8,220.3）">
          <TextInput value={(chapter.ambienceFreqs || []).join(',')} spellCheck={false}
            onValue={value => patch({ ambienceFreqs: value.split(',').map(v => Number(v.trim())).filter(v => Number.isFinite(v) && v > 0) }, '修改环境音')} />
        </Field>
        <Field label="或用音频文件" hint={audios.length ? '上传的音频素材' : '还没有音频素材'}>
          <Select value={chapter.ambienceAssetId} placeholder="使用合成氛围音"
            onChange={value => patch({ ambienceAssetId: value }, '修改环境音')}
            options={audios.map(a => ({ value: a.id, label: a.name }))} />
        </Field>
      </Section>

      <Section title="危险操作">
        <Btn icon="trash" kind="danger" onClick={() => store.deleteChapter(chapter.id)}>删除这一章（连带 ${project.lines.filter(l => l.chapterId === chapter.id).length} 句台词）</Btn>
      </Section>
    </>
  );
}
