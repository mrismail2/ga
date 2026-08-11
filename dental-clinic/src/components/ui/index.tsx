import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { initials, toneFor } from '@/lib/format';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'default', size = 'md', loading, icon, children, className, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label, children, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={cx('icon-btn', className)} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */
export function Field({
  label, hint, error, required, children,
}: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}{required && <span className="field__req"> *</span>}
      </span>
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cx('input', props.className)} />
);

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx('input select', props.className)} />
);

export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cx('input textarea', props.className)} />
);

export function Checkbox({
  label, ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */
export function Card({
  title, subtitle, actions, children, padded = true, className,
}: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  children: ReactNode; padded?: boolean; className?: string;
}) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="card__head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className={cx('card__body', !padded && 'card__body--flush')}>{children}</div>
    </section>
  );
}

export function Badge({
  children, tone = 'muted',
}: { children: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'info' | 'violet' | 'muted' }) {
  return <span className={cx('badge', `badge--${tone}`)}><i />{children}</span>;
}

const PAYMENT_TONE = { paid: 'ok', partial: 'info', unpaid: 'warn', waived: 'muted' } as const;
export function PaymentBadge({ status }: { status: keyof typeof PAYMENT_TONE }) {
  const label = { paid: 'Fully paid', partial: 'Partial', unpaid: 'Unpaid', waived: 'Waived' }[status];
  return <Badge tone={PAYMENT_TONE[status]}>{label}</Badge>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx('avatar', `avatar--${size}`, `tone-${toneFor(name)}`)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Tabs({
  tabs, value, onChange,
}: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          className={cx('tabs__tab', value === tab.id && 'is-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null && <span className="tabs__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* State placeholders — every list uses these three                            */
/* -------------------------------------------------------------------------- */
export function Skeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('skeleton', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row" style={{ opacity: 1 - i * 0.09 }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title, description, action, icon,
}: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state">
      {icon && <div className="state__icon">{icon}</div>}
      <b>{title}</b>
      {description && <p>{description}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return (
    <div className="state state--error" role="alert">
      <b>Could not load this</b>
      <p>{message}</p>
      {onRetry && <div className="state__action"><Button size="sm" onClick={onRetry}>Try again</Button></div>}
    </div>
  );
}

/** Standard wrapper: skeleton → error → empty → content. */
export function QueryBoundary<T>({
  query, skeletonRows = 5, empty, children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => void };
  skeletonRows?: number;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Skeleton rows={skeletonRows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data as T;
  const isEmpty = Array.isArray(data) && data.length === 0;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */
export function Modal({
  open, onClose, title, children, footer, wide,
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={cx('modal', wide && 'modal--wide')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal__head">
          <h3 id={titleId}>{title}</h3>
          <IconButton label="Close" onClick={onClose}>✕</IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', destructive, onConfirm, onCancel, busy,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  destructive?: boolean; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm muted">{message}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */
export function Pagination({
  page, pageSize, total, onChange,
}: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pager">
      <span className="text-xs muted">
        {total === 0 ? 'No records' : <>Showing <b>{from}–{to}</b> of {total}</>}
      </span>
      <div className="pager__buttons">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <span className="text-xs muted">Page {page} of {pages}</span>
        <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                   */
/* -------------------------------------------------------------------------- */
export function StatCard({
  label, value, hint, tone = 'brand', icon, onClick,
}: {
  label: string; value: ReactNode; hint?: ReactNode;
  tone?: string; icon?: ReactNode; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cx('stat', `tone-${tone}`, onClick && 'stat--clickable')} onClick={onClick}>
      <div className="stat__top">
        {icon && <span className="stat__icon">{icon}</span>}
        <span className="stat__label">{label}</span>
      </div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */
type Toast = { id: number; message: string; tone: 'ok' | 'danger' | 'info' };
const ToastContext = createContext<{
  notify: (message: string, tone?: Toast['tone']) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, toneValue: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone: toneValue }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', `toast--${t.tone}`)}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
