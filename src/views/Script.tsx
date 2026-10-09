/* 剧本视图：左边挑台词，中间看效果，右边改内容 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyPreview } from '../KeyPreview';
import { store, useProject, useSelection, useStore } from '../store';
import { PRESENTATION_LABEL, type Line, type Presentation } from '../types';
import { Btn, Empty, Field, Icon, Section, Select, TextArea, Thumb } from '../ui';

function linePreview(text: string, max = 48) {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat || '（空台词）';
}

export function ScriptLeft() {
  const project = useProject();
  const selection = useSelection();
  const previewIndex = useStore(s => s.previewIndex);
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const selectedLine = project.lines.find(l => l.id === selection.id && selection.kind === 'line') || null;
  const [chapterFilter, setChapterFilter] = useState<string>(selectedLine?.chapterId || project.chapters[0].id);
  const lastSelected = useRef<string | null>(null);

  useEffect(() => {
    if (selectedLine && selectedLine.id !== lastSelected.current) {
      lastSelected.current = selectedLine.id;
      setChapterFilter(selectedLine.chapterId);
    }
  }, [selectedLine]);

  const chapter = project.chapters.find(c => c.id === chapterFilter) || project.chapters[0];
  const lines = useMemo(() => {
    const scoped = project.lines.filter(l => l.chapterId === chapter?.id);
    if (!query.trim()) return scoped;
    const keyword = query.trim().toLowerCase();
    return scoped.filter(l => (l.text || '').toLowerCase().includes(keyword)
      || (project.characters.find(c => c.id === l.speakerId)?.name || '旁白').toLowerCase().includes(keyword));
  }, [project.lines, project.characters, chapter?.id, query]);

  const indexOf = (id: string) => project.lines.findIndex(l => l.id === id);

  return (
    <>
      <Section dense title="章节目录" hint="点一章，编辑它的台词">
        <div className="gs-chapterstrip">
          {project.chapters.map((item, i) => {
            const count = project.lines.filter(l => l.chapterId === item.id).length;
            return (
              <button key={item.id} className={`gs-chapterchip ${item.id === chapter?.id ? 'is-on' : ''}`}
                onClick={() => setChapterFilter(item.id)}
                onDoubleClick={() => { store.select('chapter', item.id); store.setView('chapters'); }}
                title="点击只看这一章，双击去编辑这一章">
                <span className="gs-chapterchip-no">{item.number || String(i + 1).padStart(2, '0')}</span>
                <span className="gs-chapterchip-title">{item.title || '未命名章节'}</span>
                <span className="gs-chapterchip-count">{count} 句</span>
              </button>
            );
          })}
          <button className="gs-chapterchip is-add" onClick={() => store.addChapter()}>
            <Icon name="plus" size={13} />新增章节
          </button>
        </div>
      </Section>

      <Section
        dense
        title={`台词 · ${chapter?.title || ''}`}
        hint={`${lines.length} 句${query ? '（已过滤）' : ''}`}
        actions={<input className="gs-input gs-search" placeholder="搜索台词…" value={query} onChange={e => setQuery(e.target.value)} />}
      >
        <div className="gs-linelist">
          {lines.map((line) => {
            const globalIndex = indexOf(line.id);
            const speaker = line.speakerId ? project.characters.find(c => c.id === line.speakerId) : null;
            const active = line.id === selection.id && selection.kind === 'line';
            const playing = globalIndex === previewIndex;
            return (
              <div key={line.id}
                className={`gs-line ${active ? 'is-selected' : ''} ${playing ? 'is-playing' : ''}`}
                onClick={() => { store.select('line', line.id); store.jumpPreview(globalIndex); }}>
                <span className="gs-line-no">{String(globalIndex + 1).padStart(3, '0')}</span>
                <span className="gs-line-body">
                  <span className="gs-line-head">
                    <b className={speaker ? 'is-character' : 'is-narrator'}>{speaker ? speaker.name : (project.settings.narratorLabel || '旁白')}</b>
                    {line.presentation === 'cg' && <em className="gs-tag">CG</em>}
                    {line.presentation === 'background' && <em className="gs-tag is-soft">背景</em>}
                  </span>
                  <span className="gs-line-text">{linePreview(line.text)}</span>
                </span>
                <span className="gs-line-actions" onClick={e => e.stopPropagation()}>
                  <button title="上移" onClick={() => store.moveLine(line.id, -1)}><Icon name="up" size={13} /></button>
                  <button title="下移" onClick={() => store.moveLine(line.id, 1)}><Icon name="down" size={13} /></button>
                  <button title="复制这一句" onClick={() => store.duplicateLine(line.id)}><Icon name="copy" size={13} /></button>
                  <button title="删除" className="is-danger" onClick={() => store.deleteLine(line.id)}><Icon name="trash" size={13} /></button>
                </span>
              </div>
            );
          })}
          {!lines.length && <Empty icon="text" title="这一章还没有台词" hint="点击下面的按钮开始写第一句" />}
        </div>
        <div className="gs-linelist-foot">
          <Btn icon="upload" full onClick={() => setImportOpen(value => !value)}>批量导入台词</Btn>
          {importOpen && <div className="gs-script-import">
            <TextArea value={importText} rows={6} placeholder={'旁白：海风吹过站台。\n角色名：好久不见。'} onValue={setImportText} />
            <div className="gs-row">
              <Btn icon="check" disabled={!importText.trim()} onClick={() => {
                const count = store.importScript(chapter.id, importText);
                if (count) { setImportText(''); setImportOpen(false); store.toast(`已导入 ${count} 句台词`); }
              }}>导入</Btn>
              <Btn icon="close" kind="quiet" onClick={() => setImportOpen(false)}>取消</Btn>
            </div>
          </div>}
          <Btn icon="plus" kind="solid" full onClick={() => store.addLine(chapter?.id || project.chapters[0].id, lines.length ? lines[lines.length - 1].id : undefined)}>
            在这一章末尾添加台词
          </Btn>
        </div>
      </Section>
    </>
  );
}

export function LineInspector() {
  const project = useProject();
  const selection = useSelection();
  const line: Line | undefined = project.lines.find(l => l.id === selection.id);
  const previewIndex = useStore(s => s.previewIndex);

  if (!line) {
    return (
      <Section title="台词详情" hint="从左侧选一句台词">
        <Empty title="还没有选中台词" hint="左边点一下任意一句，就能在这里修改说话人、文字、表情和演出方式。" />
      </Section>
    );
  }

  const globalIndex = project.lines.findIndex(l => l.id === line.id);
  const chapter = project.chapters.find(c => c.id === line.chapterId);
  const speaker = line.speakerId ? project.characters.find(c => c.id === line.speakerId) : null;
  const spriteChar = speaker && speaker.expressions.length ? speaker : project.characters.find(c => c.expressions.length);
  const expressions = spriteChar?.expressions || [];
  const cgAssets = project.assets.filter(a => a.kind === 'cg');
  const patch = (changes: Partial<Line>, label?: string) => store.updateLine(line.id, changes, label);

  return (
    <>
      <Section title={`台词 #${String(globalIndex + 1).padStart(3, '0')}`} hint={`属于「${chapter?.title || '未命名章节'}」`}
        actions={<Btn size="sm" icon="play" kind="quiet" title="在预览里跳到这一句" onClick={() => store.jumpPreview(globalIndex)}>
          {previewIndex === globalIndex ? '正在预览' : '预览这一句'}
        </Btn>}>
        <Field label="谁在说话" hint="旁白没有名字牌">
          <Select value={line.speakerId || ''} onChange={(value) => patch({ speakerId: value || null }, '修改说话人')}
            options={[
              { value: '', label: `旁白（${project.settings.narratorLabel || '旁白'}）` },
              ...project.characters.map(c => ({ value: c.id, label: c.name || '未命名角色' })),
            ]} />
        </Field>

        <Field label="台词内容" hint="回车可以换行">
          <TextArea value={line.text} rows={4} placeholder="在这里写台词…" onValue={(value) => patch({ text: value }, '修改台词')} />
        </Field>

        <div className="gs-row">
          <Btn size="sm" icon="plus" onClick={() => store.addLine(line.chapterId, line.id)}>在下方插入一句</Btn>
          <Btn size="sm" icon="copy" onClick={() => store.duplicateLine(line.id)}>复制</Btn>
          <Btn size="sm" icon="trash" kind="quiet" onClick={() => store.deleteLine(line.id)}>删除</Btn>
        </div>
      </Section>

      <Section title="这一句怎么演" hint="决定画面上出现什么">
        <Field label="演出方式">
          <div className="gs-seg gs-seg-full">
            {(['sprite', 'background', 'cg'] as Presentation[]).map(item => (
              <button key={item} className={line.presentation === item ? 'is-on' : ''}
                onClick={() => patch({ presentation: item }, '修改演出方式')}>{PRESENTATION_LABEL[item]}</button>
            ))}
          </div>
        </Field>

        {line.presentation === 'sprite' && (
          <>
            <Field label="表情" hint={spriteChar ? `来自「${spriteChar.name}」` : '还没有角色立绘'}>
              {expressions.length ? (
                <div className="gs-expgrid">
                  <button className={`gs-expcard ${!line.expressionId ? 'is-on' : ''}`} onClick={() => patch({ expressionId: '' }, '修改表情')}>
                    <span className="gs-keythumb is-empty"><Icon name="user" size={16} /></span>
                    <span>不指定</span>
                  </button>
                  {expressions.map(expression => {
                    const asset = project.assets.find(a => a.id === expression.assetId);
                    return (
                      <button key={expression.id} className={`gs-expcard ${line.expressionId === expression.id ? 'is-on' : ''}`}
                        onClick={() => patch({ expressionId: expression.id }, '修改表情')}>
                        <span className="gs-keythumb">
                          {asset ? <KeyPreview src={asset.src} expression={expression} /> : <Icon name="image" size={16} />}
                        </span>
                        <span>{expression.label || '表情'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Empty icon="user" title="还没有立绘表情" hint="去「角色」里上传一张立绘，就能在这里选表情了。"
                  action={<Btn size="sm" kind="solid" onClick={() => store.setView('cast')}>去添加立绘</Btn>} />
              )}
            </Field>
            {!speaker && expressions.length > 0 && (
              <p className="gs-note">这句是旁白，画面上会继续显示上一个说话角色的立绘。</p>
            )}
          </>
        )}

        {line.presentation === 'cg' && (
          <Field label="事件 CG" hint="全屏插图，适合重要场面">
            <Select value={line.cgAssetId} onChange={(value) => patch({ cgAssetId: value }, '修改事件 CG')}
              placeholder={cgAssets.length ? '选择一张 CG' : '还没有 CG 素材'}
              options={cgAssets.map(a => ({ value: a.id, label: a.name }))} />
          </Field>
        )}

        {line.presentation === 'background' && (
          <p className="gs-note">只显示本章背景图，不出现人物——适合写景、转场、心理描写。</p>
        )}
      </Section>

      <Section title="所属章节" hint="调整顺序或把这一句挪到别的章">
        <Field label="章节">
          <Select value={line.chapterId} onChange={(value) => store.moveLineToChapter(line.id, value)} options={project.chapters.map(c => ({ value: c.id, label: c.title || '未命名章节' }))} />
        </Field>
        <div className="gs-row">
          <Btn size="sm" icon="up" onClick={() => store.moveLine(line.id, -1)}>上移一句</Btn>
          <Btn size="sm" icon="down" onClick={() => store.moveLine(line.id, 1)}>下移一句</Btn>
        </div>
      </Section>
    </>
  );
}
