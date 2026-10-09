/* 素材视图：图片与音频都在这里 */
import { useRef, useState } from 'react';
import { importFiles } from '../assets';
import { store, useProject, useSelection } from '../store';
import { KIND_LABEL, formatBytes, type AssetKind } from '../types';
import { Btn, Empty, Field, Icon, Section, Select, TextInput } from '../ui';

const KINDS: (AssetKind | 'all')[] = ['all', 'background', 'sprite', 'cg', 'audio'];

export function AssetsLeft() {
  const project = useProject();
  const selection = useSelection();
  const [filter, setFilter] = useState<AssetKind | 'all'>('all');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = filter === 'all' ? project.assets : project.assets.filter(a => a.kind === filter);

  async function upload(files: FileList | File[] | null) {
    const list = files ? Array.from(files as FileList) : [];
    if (!list.length) return;
    try {
      const imported = await importFiles(list);
      store.addAssets(imported);
      store.toast(`已导入 ${imported.length} 个素材`);
    } catch (error) {
      store.toast(error instanceof Error ? error.message : '导入失败', 'warn');
    }
  }

  return (
    <>
      <Section dense title="素材库" hint={`${project.assets.length} 个 · ${formatBytes(project.assets.reduce((sum, a) => sum + (a.bytes || 0), 0))}`}
        actions={<Btn size="sm" icon="upload" kind="solid" onClick={() => inputRef.current?.click()}>导入</Btn>}>
        <div
          className={`gs-dropzone ${dragging ? 'is-drag' : ''}`}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="download" size={20} />
          <strong>把图片拖进来</strong>
          <small>或点击选择文件 · 支持 PNG / JPG / WebP / MP3</small>
        </div>

        <div className="gs-seg gs-seg-full gs-seg-scroll">
          {KINDS.map(kind => (
            <button key={kind} className={filter === kind ? 'is-on' : ''} onClick={() => setFilter(kind)}>
              {kind === 'all' ? '全部' : KIND_LABEL[kind]}
              <em>{kind === 'all' ? project.assets.length : project.assets.filter(a => a.kind === kind).length}</em>
            </button>
          ))}
        </div>

        {assets.length ? (
          <div className="gs-assetgrid">
            {assets.map(asset => {
              const usage = store.assetUsage(asset.id);
              return (
                <button key={asset.id} className={`gs-asset ${asset.id === selection.id && selection.kind === 'asset' ? 'is-on' : ''}`}
                  onClick={() => store.select('asset', asset.id)} title={`${asset.name} · ${KIND_LABEL[asset.kind]}`}>
                  <span className="gs-asset-pic">
                    {asset.kind === 'audio'
                      ? <Icon name="music" size={20} />
                      : <img src={asset.src} alt="" loading="lazy" />}
                  </span>
                  <span className="gs-asset-meta">
                    <b>{asset.name}</b>
                    <small>{KIND_LABEL[asset.kind]}{usage ? ` · 用到 ${usage} 处` : ' · 未使用'}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty icon="image" title="这个分类还是空的" hint="把背景图、立绘、事件 CG 拖进上面的区域。" />
        )}
      </Section>
      <input ref={inputRef} type="file" accept="image/*,audio/*" multiple hidden
        onChange={event => { void upload(event.target.files); event.target.value = ''; }} />
    </>
  );
}

export function AssetInspector() {
  const project = useProject();
  const selection = useSelection();
  const asset = project.assets.find(a => a.id === selection.id);

  if (!asset) {
    return (
      <Section title="素材详情">
        <Empty icon="image" title="还没有选中素材" hint="左边点一下任意一个素材，可以改名、改分类、看它被用在哪里。" />
      </Section>
    );
  }

  const usages: string[] = [];
  project.chapters.forEach(chapter => {
    if (chapter.backgroundId === asset.id) usages.push(`背景 · ${chapter.title || '未命名章节'}`);
    if (chapter.ambienceAssetId === asset.id) usages.push(`环境音 · ${chapter.title || '未命名章节'}`);
  });
  project.lines.forEach((line, i) => { if (line.cgAssetId === asset.id) usages.push(`事件 CG · 第 ${i + 1} 句`); });
  project.characters.forEach(character => character.expressions.forEach(expression => {
    if (expression.assetId === asset.id) usages.push(`立绘 · ${character.name} / ${expression.label || '表情'}`);
  }));

  return (
    <>
      <Section title={asset.name} hint={KIND_LABEL[asset.kind]}
        actions={<Btn size="sm" icon="trash" kind="quiet" onClick={() => store.deleteAsset(asset.id)}>删除</Btn>}>
        <div className="gs-assetpreview">
          {asset.kind === 'audio'
            ? <audio src={asset.src} controls />
            : <img src={asset.src} alt={asset.name} />}
        </div>
        <Field label="名称" hint="方便自己在列表里辨认">
          <TextInput value={asset.name} onValue={value => store.updateAsset(asset.id, { name: value })} />
        </Field>
        <Field label="用途分类" hint="分类只影响整理，不影响使用">
          <Select value={asset.kind} onChange={value => store.updateAsset(asset.id, { kind: value })} options={KINDS.filter(k => k !== 'all').map(k => ({ value: k as AssetKind, label: KIND_LABEL[k as AssetKind] }))} />
        </Field>
        <div className="gs-stats">
          <div><strong>{asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}</strong><span>像素尺寸</span></div>
          <div><strong>{formatBytes(asset.bytes || Math.round(asset.src.length * 0.75))}</strong><span>文件体积</span></div>
          <div><strong>{usages.length}</strong><span>被使用</span></div>
        </div>
        {asset.width && asset.height && asset.width < 900 && asset.kind === 'background' && (
          <p className="gs-note is-warn">这张背景图偏小（建议 1280×720 以上），放到大屏上可能发虚。</p>
        )}
      </Section>

      <Section title="用在哪里" hint={usages.length ? '' : '还没有被使用'}>
        {usages.length ? (
          <ul className="gs-usage">{usages.map((text, i) => <li key={i}><Icon name="dot" size={10} />{text}</li>)}</ul>
        ) : (
          <p className="gs-note">这个素材还没有被任何章节、角色或台词引用，可以放心删除。</p>
        )}
      </Section>

      {asset.kind !== 'audio' && (
        <Section title="使用建议">
          <ul className="gs-tips">
            <li><b>背景</b>：1280×720 或更宽，横向构图，人物通常站右侧。</li>
            <li><b>立绘</b>：竖构图，人物居中、纯色背景（默认品红）最好抠。</li>
            <li><b>事件 CG</b>：和背景同尺寸，用来演重要的全屏画面。</li>
          </ul>
        </Section>
      )}
    </>
  );
}
