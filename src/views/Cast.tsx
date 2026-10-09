/* 角色视图：谁登场、什么表情、站在哪一边 */
import { useEffect, useRef, useState } from 'react';
import { importFiles } from '../assets';
import { KeyPreview } from '../KeyPreview';
import { store, useProject, useSelection } from '../store';
import { SLOT_LABEL, type Character, type Slot } from '../types';
import { Btn, ColorInput, Empty, Field, Icon, Section, Select, Slider, TextInput, Thumb } from '../ui';

export function CastLeft() {
  const project = useProject();
  const selection = useSelection();
  const assignedIds = new Set(project.characters.flatMap(character => character.expressions.map(e => e.assetId)));
  const spriteAssets = project.assets.filter(a => a.kind === 'sprite' && !assignedIds.has(a.id));
  const activeCharacter = project.characters.find(c => c.id === selection.id) || project.characters[0];
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || !files.length || !activeCharacter) return;
    const target = activeCharacter;
    try {
      const assets = await importFiles(Array.from(files), 'sprite');
      // 导入素材 + 分配表情算「一步」，撤销一次就能回到上传前
      store.batch(`导入 ${assets.length} 张立绘`, () => {
        store.addAssets(assets, false);
        assets.forEach(asset => store.addExpression(target.id, asset.id, asset.name, false));
      });
      store.toast(`已给「${target.name}」添加 ${assets.length} 张立绘`);
    } catch (error) {
      store.toast(error instanceof Error ? error.message : '导入失败', 'warn');
    }
  }

  function assign(assetId: string, assetName: string) {
    if (!activeCharacter) return;
    store.addExpression(activeCharacter.id, assetId, assetName, false);
    store.toast(`已把「${assetName}」加进「${activeCharacter.name}」的表情`);
  }

  return (
    <>
      <Section dense title="角色" hint={`${project.characters.length} 位`}
        actions={<Btn size="sm" icon="plus" kind="solid" onClick={() => store.addCharacter()}>新增角色</Btn>}>
        <div className="gs-cardlist">
          {project.characters.map(character => {
            const first = character.expressions
              .map(expression => ({ expression, asset: project.assets.find(a => a.id === expression.assetId) }))
              .find(item => item.asset);
            const lines = project.lines.filter(l => l.speakerId === character.id).length;
            return (
              <button key={character.id} className={`gs-card ${character.id === selection.id && selection.kind === 'character' ? 'is-on' : ''}`}
                onClick={() => store.select('character', character.id)}>
                <span className="gs-keythumb is-card">
                  {first?.asset ? <KeyPreview src={first.asset.src} expression={first.expression} /> : <Icon name="user" size={16} />}
                </span>
                <span className="gs-card-body">
                  <strong>{character.name || '未命名角色'}</strong>
                  <small>{SLOT_LABEL[character.slot]} · {character.expressions.length} 个表情 · {lines} 句台词</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="gs-note">没有立绘的角色也能用——当「旁白」或者纯文字角色。</p>
      </Section>

      <Section dense
        title="立绘工作台"
        hint={activeCharacter ? `上传的立绘会自动加进「${activeCharacter.name}」` : '先新增一位角色'}
        actions={<Btn size="sm" icon="upload" kind="solid" onClick={() => inputRef.current?.click()} disabled={!activeCharacter}>上传立绘</Btn>}>
        <button className="gs-dropzone" onClick={() => inputRef.current?.click()} disabled={!activeCharacter}>
          <Icon name="download" size={20} />
          <strong>把立绘拖到这里</strong>
          <small>纯色背景（默认品红）会自动抠掉 · 支持多选</small>
        </button>
        {spriteAssets.length > 0 && (
          <>
            <p className="gs-note">素材库里还有 {spriteAssets.length} 张没有分配给别人，点一下就能加进「{activeCharacter?.name || '当前角色'}」：</p>
            <div className="gs-minigrid">
              {spriteAssets.slice(0, 12).map(asset => (
                <button key={asset.id} className="gs-minithumb gs-minithumb-action" title={`把「${asset.name}」加进「${activeCharacter?.name || ''}」`}
                  onClick={() => assign(asset.id, asset.name)}>
                  <Thumb src={asset.src} ratio={3 / 4} fallback="user" />
                </button>
              ))}
            </div>
          </>
        )}
      </Section>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={event => { void upload(event.target.files); event.target.value = ''; }} />
    </>
  );
}

export function CharacterInspector() {
  const project = useProject();
  const selection = useSelection();
  const character: Character | undefined = project.characters.find(c => c.id === selection.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingLabel, setPendingLabel] = useState<{ id: string; value: string } | null>(null);

  if (!character) {
    return (
      <Section title="角色详情">
        <Empty title="还没有选中角色" hint="左边点一下任意一位角色。" />
      </Section>
    );
  }

  const patch = (changes: Partial<Character>, label?: string) => store.updateCharacter(character.id, changes, label);

  async function upload(files: FileList | null) {
    if (!files || !files.length || !character) return;
    const target = character;
    try {
      const assets = await importFiles(Array.from(files), 'sprite');
      store.batch(`导入 ${assets.length} 张立绘`, () => {
        store.addAssets(assets, false);
        assets.forEach(asset => store.addExpression(target.id, asset.id, asset.name, false));
      });
      store.toast(`已添加 ${assets.length} 张立绘`);
    } catch (error) {
      store.toast(error instanceof Error ? error.message : '导入失败', 'warn');
    }
  }

  return (
    <>
      <Section title={character.name || '未命名角色'} hint={`${character.expressions.length} 个表情`}
        actions={<Btn size="sm" icon="trash" kind="quiet" onClick={() => store.deleteCharacter(character.id)}>删除</Btn>}>
        <Field label="名字" hint="显示在名字牌上">
          <TextInput value={character.name} placeholder="小夏" onValue={value => patch({ name: value }, '修改角色名')} />
        </Field>
        <Field label="英文名 / 副标" hint="可选">
          <TextInput value={character.nameEn} placeholder="NATSU" onValue={value => patch({ nameEn: value }, '修改角色英文名')} />
        </Field>
        <Field label="站位" hint="立绘出现在画面的哪一侧">
          <div className="gs-seg gs-seg-full">
            {(['left', 'center', 'right'] as Slot[]).map(slot => (
              <button key={slot} className={character.slot === slot ? 'is-on' : ''} onClick={() => patch({ slot }, '修改站位')}>{SLOT_LABEL[slot]}</button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="表情 / 立绘" hint="上传多张不同表情的立绘，剧本里就能切换"
        actions={<Btn size="sm" icon="upload" kind="solid" onClick={() => inputRef.current?.click()}>上传立绘</Btn>}>
        {character.expressions.length ? (
          <div className="gs-explist">
            {character.expressions.map(expression => {
              const asset = project.assets.find(a => a.id === expression.assetId);
              return (
                <div key={expression.id} className="gs-exprow">
                  <div className="gs-exprow-art">
                    {asset ? <KeyPreview src={asset.src} expression={expression} /> : <Icon name="image" size={18} />}
                  </div>
                  <div className="gs-exprow-body">
                    <TextInput
                      /* 必须显示本地草稿：直接绑 store 里的值会让输入框打不进字（受控组件会被重置） */
                      value={pendingLabel && pendingLabel.id === expression.id ? pendingLabel.value : expression.label}
                      placeholder="表情名（温柔 / 生气…）"
                      onChange={e => setPendingLabel({ id: expression.id, value: e.target.value })}
                      onBlur={() => {
                        if (pendingLabel && pendingLabel.id === expression.id) {
                          store.updateExpression(character.id, expression.id, { label: pendingLabel.value });
                          setPendingLabel(null);
                        }
                      }} />
                    <div className="gs-exprow-controls">
                      <button className={`gs-chip ${expression.keyOut ? 'is-on' : ''}`}
                        onClick={() => store.updateExpression(character.id, expression.id, { keyOut: !expression.keyOut })}>
                        <Icon name="wand" size={12} />自动去背景
                      </button>
                      {expression.keyOut && (
                        <>
                          <span className="gs-inline-color">
                            <ColorInput value={expression.keyColor} onChange={value => store.updateExpression(character.id, expression.id, { keyColor: value || '#ff00ff' })} />
                          </span>
                          <Slider value={expression.tolerance ?? 110} min={20} max={200}
                            onChange={value => store.updateExpression(character.id, expression.id, { tolerance: value })}
                            format={value => `强度 ${value}`} />
                          <button className={`gs-chip ${expression.edgeOnly ? 'is-on' : ''}`}
                            title="只清除与画面边缘连通的背景；角色身上与背景同色的部分会被保留"
                            onClick={() => store.updateExpression(character.id, expression.id, { edgeOnly: !expression.edgeOnly })}>
                            仅抠边缘
                          </button>
                        </>
                      )}
                      <button className="gs-chip is-danger" onClick={() => store.deleteExpression(character.id, expression.id)}>
                        <Icon name="trash" size={12} />移除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="user" title="还没有立绘" hint="上传一张人物图（背景是纯色也行，会自动抠掉），就能在剧本里使用表情了。"
            action={<Btn kind="solid" icon="upload" onClick={() => inputRef.current?.click()}>选择图片上传</Btn>} />
        )}
        <p className="gs-note">提示：立绘建议 PNG/JPG，人物居中、纯色背景（默认品红 #ff00ff）最容易被干净抠出。</p>
      </Section>

      <Section title="出场统计">
        <div className="gs-stats">
          <div><strong>{project.lines.filter(l => l.speakerId === character.id).length}</strong><span>句台词</span></div>
          <div><strong>{character.expressions.length}</strong><span>个表情</span></div>
          <div><strong>{project.lines.filter(l => l.expressionId && character.expressions.some(e => e.id === l.expressionId)).length}</strong><span>次表情演出</span></div>
        </div>
      </Section>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={event => { void upload(event.target.files); event.target.value = ''; }} />
    </>
  );
}
