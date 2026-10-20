import type { ComponentChildren, Ref } from 'preact';
import { useEffect } from 'preact/hooks';
import { navigate } from '../router';

export function Button(props: {
  variant?: 'raised' | 'primary';
  disabled?: boolean;
  onClick?: () => void;
  children: ComponentChildren;
  type?: 'button' | 'submit';
  wide?: boolean;
  label?: string;
}) {
  const { variant = 'raised', disabled, onClick, children, type = 'button', wide, label } = props;
  return (
    <button
      type={type}
      class={`btn${variant === 'primary' ? ' btn-primary' : ''}${wide ? ' btn-wide' : ''}`}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {children}
      {disabled && <span class="sr-only"> (unavailable)</span>}
    </button>
  );
}

export function NumberField(props: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  error?: string | null;
  warning?: string | null;
  enterKeyHint?: 'next' | 'done';
  onEnter?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { id, label, value, onInput, error, warning, enterKeyHint = 'next', onEnter, inputRef } = props;
  return (
    <div class={`field${error ? ' field-error' : ''}`}>
      <label for={id}>{label}</label>
      <input
        id={id}
        ref={inputRef}
        class="inset"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        value={value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error || warning ? `${id}-msg` : undefined}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {(error || warning) && (
        <p id={`${id}-msg`} class={error ? 'msg msg-error' : 'msg msg-warn'}>
          {error ?? warning}
        </p>
      )}
    </div>
  );
}

export function Tile({ value, caption }: { value: string; caption: string }) {
  return (
    <div class="tile raised-lg">
      <div class="big-num">{value}</div>
      <div class="tile-caption secondary">{caption}</div>
    </div>
  );
}

export function ListRow(props: { title: string; detail?: ComponentChildren; tag?: string; done?: boolean; onEdit?: () => void }) {
  const { title, detail, tag, done, onEdit } = props;
  const body = (
    <>
      <span class="row-main">
        <span class="row-title">
          {done && <span class="done-mark" aria-label="done">✓ </span>}
          {title}
        </span>
        {detail && <span class="row-detail secondary">{detail}</span>}
      </span>
      {tag && <span class="tag">{tag}</span>}
    </>
  );
  return onEdit ? (
    <button type="button" class={`list-row raised${done ? ' row-done' : ''}`} onClick={onEdit}>
      {body}
    </button>
  ) : (
    <div class={`list-row raised${done ? ' row-done' : ''}`}>{body}</div>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet raised-lg" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <Button onClick={onClose} label="Close">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast(props: { message: string; actionLabel?: string; onAction?: () => void; timeoutMs: number; onClose: () => void }) {
  const { message, actionLabel, onAction, timeoutMs, onClose } = props;
  useEffect(() => {
    const t = window.setTimeout(onClose, timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs, onClose]);
  return (
    <div class="toast raised-lg" role="status">
      <span>{message}</span>
      {actionLabel && onAction && (
        <Button
          onClick={() => {
            onAction();
            onClose();
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function Pill({ tone = 'blue', children }: { tone?: 'blue' | 'neutral'; children: ComponentChildren }) {
  return <span class={`pill pill-${tone}`}>{children}</span>;
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (100 * value) / max) : 0;
  return (
    <div class="progress-wrap">
      <div class="progress inset" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div class="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div class="label">{label}</div>
    </div>
  );
}

export function Banner(props: { title: string; children?: ComponentChildren; actionLabel?: string; onAction?: () => void }) {
  return (
    <div class="banner raised" role="alert">
      <strong>{props.title}</strong>
      {props.children && <div class="banner-body">{props.children}</div>}
      {props.actionLabel && props.onAction && <Button onClick={props.onAction}>{props.actionLabel}</Button>}
    </div>
  );
}

export function Screen({ title, children, back = true }: { title: string; children: ComponentChildren; back?: boolean }) {
  return (
    <main class="screen">
      <header class="screen-head">
        {back && (
          <Button onClick={() => navigate('/')} label="Back to main screen">
            ‹ Back
          </Button>
        )}
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}
