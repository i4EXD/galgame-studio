/* 编辑器通用 UI 组件（与播放器同一套视觉语言：深色、细线、菱形点缀） */
import React, { useEffect, useRef, useState } from 'react';

export type IconName =
  | 'play' | 'pause' | 'save' | 'open' | 'plus' | 'trash' | 'copy' | 'up' | 'down'
  | 'undo' | 'redo' | 'image' | 'user' | 'book' | 'palette' | 'rocket' | 'help'
  | 'close' | 'check' | 'warn' | 'eye' | 'chevron' | 'music' | 'star' | 'arrow'
  | 'refresh' | 'settings' | 'sparkles' | 'folder' | 'edit' | 'grid' | 'text'
  | 'wand' | 'download' | 'upload' | 'expand' | 'film' | 'layers' | 'dot';

const PATHS: Record<IconName, string> = {
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h9V3M7 21v-8h10v8"/>',
  open: '<path d="M3 7V4h7l3 3h8v13H3V7Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14"/>',
  copy: '<path d="M9 9h11v11H9zM4 15V4h11"/>',
  up: '<path d="M12 19V5m-7 7 7-7 7 7"/>',
  down: '<path d="M12 5v14m7-7-7 7-7-7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',
  image: '<path d="M3 4h18v16H3z"/><circle cx="9" cy="10" r="2"/><path d="m4 19 6-6 4 4 3-3 3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3-4-5-9-5Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="9.5" cy="6.5" r="1.2"/>',
  rocket: '<path d="M6 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M12 3c3 0 6 3 6 6 0 5-6 9-6 9S6 14 6 9c0-3 3-6 6-6Z"/><circle cx="12" cy="9" r="1.6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  music: '<circle cx="7" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M10 18V6l11-2v12"/>',
  star: '<path d="m12 2 2.8 6.5L22 12l-7.2 3.5L12 22l-2.8-6.5L2 12l7.2-3.5Z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  refresh: '<path d="M4 10a8 8 0 0 1 13-5l3 3"/><path d="M20 14a8 8 0 0 1-13 5l-3-3"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  settings: '<path d="m9 3-.8 2.5-2.5.6-2 3.4 1.7 2-.2 2.5 1.7 3.3 2.6.3L11 20h3l1.2-2.4 2.6-.4 1.8-3.2-1.2-2.3 1.2-2.3-1.9-3.2-2.6-.4L14 3Z"/><circle cx="12" cy="11.5" r="3"/>',
  sparkles: '<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z"/><path d="m18 15 .9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9Z"/>',
  folder: '<path d="M3 7V5h6l2 2h10v12H3V7Z"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  wand: '<path d="m5 19 9-9"/><path d="M14 6.5 17.5 10"/><path d="M17 3v3M21 7h-3M19.5 4.5 17 7M15 12h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 19h16"/>',
  upload: '<path d="M12 17V5m-5 5 5-5 5 5"/><path d="M4 19h16"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  film: '<path d="M3 4h18v16H3z"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

export function Btn(props: {
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  icon?: IconName;
  kind?: 'ghost' | 'solid' | 'primary' | 'danger' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  active?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
}) {
  const { children, onClick, icon, kind = 'ghost', size = 'md', disabled, title, active, full, type = 'button' } = props;
  return (
    <button
      type={type}
      className={`gs-btn gs-btn-${kind} gs-btn-${size} ${active ? 'is-active' : ''} ${full ? 'is-full' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : size === 'lg' ? 18 : 15} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Field({ label, hint, children, inline }: { label?: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={`gs-field ${inline ? 'is-inline' : ''}`}>
      {label && <span className="gs-field-label">{label}{hint && <em>{hint}</em>}</span>}
      <span className="gs-field-body">{children}</span>
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { onValue?: (value: string) => void }) {
  const { onValue, ...rest } = props;
  return (
    <input
      {...rest}
      className={`gs-input ${rest.className || ''}`}
      onChange={(event) => { rest.onChange?.(event); onValue?.(event.target.value); }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { onValue?: (value: string) => void }) {
  const { onValue, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(420, Math.max(64, element.scrollHeight))}px`;
  }, [rest.value]);
  return (
    <textarea
      {...rest}
      ref={ref}
      className={`gs-input gs-textarea ${rest.className || ''}`}
      onChange={(event) => { rest.onChange?.(event); onValue?.(event.target.value); }}
    />
  );
}

export function Select<T extends string>(props: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  return (
    <select className="gs-input gs-select" value={props.value} onChange={(event) => props.onChange(event.target.value as T)}>
      {props.placeholder && <option value="">{props.placeholder}</option>}
      {props.options.map(option => (
        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
      ))}
    </select>
  );
}

export function Slider(props: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format?: (value: number) => string }) {
  return (
    <span className="gs-slider">
      <input type="range" min={props.min} max={props.max} step={props.step ?? 1} value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))} />
      <output>{props.format ? props.format(props.value) : props.value}</output>
    </span>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label?: string }) {
  return (
    <button type="button" className={`gs-toggle ${value ? 'is-on' : ''}`} role="switch" aria-checked={value}
      aria-label={label} onClick={() => onChange(!value)}>
      <span />
    </button>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <span className="gs-color">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : '#000000'} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value); }} />
      <input className="gs-input" value={draft} spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (/^#[0-9a-f]{6}$/i.test(draft)) onChange(draft); else setDraft(value); }} />
      {value && <button type="button" className="gs-color-clear" title="清除" onClick={() => onChange('')}>×</button>}
    </span>
  );
}

export function Section({ title, hint, children, actions, dense }: {
  title?: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode; dense?: boolean;
}) {
  return (
    <section className={`gs-section ${dense ? 'is-dense' : ''}`}>
      {title && (
        <header className="gs-section-head">
          <div><h3>{title}</h3>{hint && <p>{hint}</p>}</div>
          {actions && <div className="gs-section-actions">{actions}</div>}
        </header>
      )}
      <div className="gs-section-body">{children}</div>
    </section>
  );
}

export function Empty({ icon = 'sparkles', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="gs-empty">
      <span className="gs-empty-icon"><Icon name={icon} size={26} /></span>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className={`gs-modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="gs-modal-head">
          <div>
            {subtitle && <span className="gs-eyebrow">{subtitle}</span>}
            <h2>{title}</h2>
          </div>
          <button className="gs-icon-btn" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        </header>
        <div className="gs-modal-body">{children}</div>
        {footer && <footer className="gs-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Toast({ text, tone }: { text: string; tone: 'ok' | 'warn' }) {
  return (
    <div className={`gs-toast is-${tone}`}>
      <Icon name={tone === 'warn' ? 'warn' : 'check'} size={15} />
      <span>{text}</span>
    </div>
  );
}

export function Thumb({ src, ratio = 16 / 9, className, fallback = 'image' }: { src?: string; ratio?: number; className?: string; fallback?: IconName }) {
  return (
    <span className={`gs-thumb ${className || ''}`} style={{ aspectRatio: String(ratio) }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <Icon name={fallback} size={18} />}
    </span>
  );
}

export function useConfirm() {
  const [request, setRequest] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  const confirm = (message: string) => new Promise<boolean>((resolve) => setRequest({ message, resolve }));
  const node = request ? (
    <Modal title="确认操作" subtitle="CONFIRM" onClose={() => { request.resolve(false); setRequest(null); }}
      footer={<>
        <Btn kind="quiet" onClick={() => { request.resolve(false); setRequest(null); }}>取消</Btn>
        <Btn kind="danger" onClick={() => { request.resolve(true); setRequest(null); }}>确定</Btn>
      </>}>
      <p className="gs-confirm-text">{request.message}</p>
    </Modal>
  ) : null;
  return { confirm, node };
}
