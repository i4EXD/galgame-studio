/* 主题与作品信息：换肤、换字体、换氛围，以及这部作品的自我介绍 */
import { store, useProject } from '../store';
import { THEME_PRESETS } from '../types';
import { Btn, Field, Icon, Section, Select, Slider, TextArea, TextInput, Toggle } from '../ui';

export function ThemeLeft() {
  const project = useProject();
  const theme = project.theme;

  return (
    <>
      <Section dense title="配色风格" hint="点一下，预览立刻变">
        <div className="gs-swatches">
          {THEME_PRESETS.map(preset => (
            <button key={preset.id} className={`gs-swatch ${theme.preset === preset.id ? 'is-on' : ''}`}
              onClick={() => store.update(p => ({ ...p, theme: { ...p.theme, ...preset.theme } }), `切换到「${preset.name}」`)}>
              <span className="gs-swatch-pic" style={{ background: preset.colors.bg }}>
                <i style={{ background: preset.colors.panel }} />
                <b style={{ background: preset.colors.accent }} />
                <em style={{ background: preset.colors.ink }} />
              </span>
              <span className="gs-swatch-body">
                <strong>{preset.name}</strong>
                <small>{preset.hint}</small>
              </span>
              {theme.preset === preset.id && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      </Section>

      <Section dense title="画面氛围">
        <div className="gs-switchlist">
          <label><span><b>胶片颗粒</b><small>细小的噪点质感</small></span>
            <Toggle value={theme.grain} onChange={value => store.setTheme({ grain: value })} label="胶片颗粒" /></label>
          <label><span><b>漂浮光尘</b><small>空气里慢慢上升的亮点</small></span>
            <Toggle value={theme.dust} onChange={value => store.setTheme({ dust: value })} label="漂浮光尘" /></label>
          <label><span><b>立绘呼吸</b><small>人物轻微的起伏，更“活”</small></span>
            <Toggle value={theme.motion} onChange={value => store.setTheme({ motion: value })} label="立绘呼吸" /></label>
          <label><span><b>标题界面</b><small>开场先显示作品标题</small></span>
            <Toggle value={project.settings.titleScreen} onChange={value => store.setSettings({ titleScreen: value })} label="标题界面" /></label>
        </div>
        <Field label="底色遮罩" hint="让文字更好读">
          <div className="gs-seg gs-seg-full">
            {([['on', '标准'], ['soft', '轻柔'], ['off', '无']] as const).map(([value, label]) => (
              <button key={value} className={theme.veil === value ? 'is-on' : ''} onClick={() => store.setTheme({ veil: value })}>{label}</button>
            ))}
          </div>
        </Field>
        <Field label="对话框宽度">
          <div className="gs-seg gs-seg-full">
            <button className={theme.layout === 'bottom' ? 'is-on' : ''} onClick={() => store.setTheme({ layout: 'bottom' })}>标准</button>
            <button className={theme.layout === 'wide' ? 'is-on' : ''} onClick={() => store.setTheme({ layout: 'wide' })}>通栏</button>
          </div>
        </Field>
      </Section>
    </>
  );
}

export function ThemeInspector() {
  const project = useProject();
  const theme = project.theme;
  const settings = project.settings;

  return (
    <>
      <Section title="这个世界的颜色" hint="改完马上能在中间的预览里看到">
        <Field label="主色" hint="名字牌、按钮、进度条">
          <span className="gs-colorline">
            <input type="color" value={theme.accent} onChange={e => store.setTheme({ accent: e.target.value })} />
            <input className="gs-input" value={theme.accent} spellCheck={false} onChange={e => store.setTheme({ accent: e.target.value })} />
          </span>
        </Field>
        <Field label="名牌文字色">
          <span className="gs-colorline">
            <input type="color" value={theme.accentInk} onChange={e => store.setTheme({ accentInk: e.target.value })} />
            <input className="gs-input" value={theme.accentInk} spellCheck={false} onChange={e => store.setTheme({ accentInk: e.target.value })} />
          </span>
        </Field>
        <Field label="对话框圆角">
          <Slider value={theme.radius} min={0} max={18} onChange={value => store.setTheme({ radius: value })} format={value => `${value} px`} />
        </Field>
        <Field label="对话框不透明度" hint="越高越容易读字">
          <Slider value={theme.dialogOpacity} min={45} max={100} onChange={value => store.setTheme({ dialogOpacity: value })} format={value => `${value}%`} />
        </Field>
        <Field label="立绘大小">
          <Slider value={Math.round(theme.spriteScale * 100)} min={60} max={140} onChange={value => store.setTheme({ spriteScale: value / 100 })} format={value => `${value}%`} />
        </Field>
      </Section>

      <Section title="排版">
        <Field label="正文字体">
          <div className="gs-seg gs-seg-full">
            <button className={theme.font === 'serif' ? 'is-on' : ''} onClick={() => store.setTheme({ font: 'serif' })}>衬线（文艺）</button>
            <button className={theme.font === 'sans' ? 'is-on' : ''} onClick={() => store.setTheme({ font: 'sans' })}>黑体（清爽）</button>
          </div>
        </Field>
        <Field label="台词对齐">
          <div className="gs-seg gs-seg-full">
            <button className={theme.align === 'left' ? 'is-on' : ''} onClick={() => store.setTheme({ align: 'left' })}>左对齐</button>
            <button className={theme.align === 'center' ? 'is-on' : ''} onClick={() => store.setTheme({ align: 'center' })}>居中</button>
          </div>
        </Field>
        <Field label="旁白称呼" hint="显示在旁白名字牌上">
          <TextInput value={settings.narratorLabel} onValue={value => store.setSettings({ narratorLabel: value })} />
        </Field>
      </Section>

      <Section title="作品信息" hint="会出现在标题、结尾与导出的文件里">
        <Field label="作品名">
          <TextInput value={project.title} onValue={value => store.setProjectMeta({ title: value })} />
        </Field>
        <Field label="副标题 / 英文名">
          <TextInput value={project.subtitle} onValue={value => store.setProjectMeta({ subtitle: value })} />
        </Field>
        <Field label="作者署名">
          <TextInput value={project.author} placeholder="你的名字" onValue={value => store.setProjectMeta({ author: value })} />
        </Field>
        <Field label="一句话简介">
          <TextInput value={project.tagline} onValue={value => store.setProjectMeta({ tagline: value })} />
        </Field>
        <Field label="作品说明" hint="显示在主菜单里">
          <TextArea value={project.description} rows={2} onValue={value => store.setProjectMeta({ description: value })} />
        </Field>
      </Section>

      <Section title="界面文案" hint="这些字都会原样出现在游戏里">
        <Field label="左侧竖排文字">
          <TextInput value={settings.sideNote} onValue={value => store.setSettings({ sideNote: value })} />
        </Field>
        <Field label="竖排文字第二行">
          <TextInput value={settings.sideNoteSub} onValue={value => store.setSettings({ sideNoteSub: value })} />
        </Field>
        <Field label="对话框上方小字">
          <TextInput value={settings.connectionLabel} onValue={value => store.setSettings({ connectionLabel: value })} />
        </Field>
      </Section>

      <Section title="结尾与标题页">
        <Field label="标题页标语" hint="支持 <br /> 换行">
          <TextArea value={settings.titleTagline} rows={2} onValue={value => store.setSettings({ titleTagline: value })} />
        </Field>
        <Field label="结局标题">
          <TextInput value={settings.endingTitle} onValue={value => store.setSettings({ endingTitle: value })} />
        </Field>
        <Field label="结局小标">
          <TextInput value={settings.endingEyebrow} onValue={value => store.setSettings({ endingEyebrow: value })} />
        </Field>
        <Field label="结局正文" hint="支持 <br /> 换行">
          <TextArea value={settings.endingText} rows={3} onValue={value => store.setSettings({ endingText: value })} />
        </Field>
        <Field label="致谢">
          <TextInput value={settings.endingThanks} onValue={value => store.setSettings({ endingThanks: value })} />
        </Field>
        <Field label="存档位数量">
          <Select value={String(settings.saves)} onChange={value => store.setSettings({ saves: Number(value) })}
            options={[3, 6, 9, 12].map(n => ({ value: String(n), label: `${n} 个存档位` }))} />
        </Field>
        <div className="gs-row">
          <Btn size="sm" icon="refresh" onClick={() => store.update(p => ({ ...p, theme: { ...p.theme, ...THEME_PRESETS[0].theme } }), '恢复默认配色')}>恢复默认配色</Btn>
        </div>
      </Section>
    </>
  );
}
