import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PageCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <main className={cx('ui-page-canvas', className)}>{children}</main>;
}

export function FrameShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('ui-frame-shell', className)}>{children}</div>;
}

export function WorkbenchFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FrameShell
      className={cx(
        'mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1820px] rounded-[32px] xl:grid-cols-[88px_330px_minmax(0,1fr)_360px] lg:grid-cols-[88px_320px_minmax(0,1fr)]',
        className
      )}
    >
      {children}
    </FrameShell>
  );
}

export function SurfaceCard({
  children,
  className,
  tone = 'default',
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: 'default' | 'strong' | 'soft' | 'accent';
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        'ui-surface-card',
        tone === 'strong' && 'ui-surface-card-strong',
        tone === 'soft' && 'ui-surface-card-soft',
        tone === 'accent' && 'ui-surface-card-accent',
        interactive && 'ui-surface-card-interactive',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('ui-eyebrow', className)}>{children}</div>;
}

export function TitleBlock({
  eyebrow,
  title,
  description,
  className,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={cx('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-soft)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  className,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        {eyebrow ? <Eyebrow className="text-white/52">{eyebrow}</Eyebrow> : null}
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-soft)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  return (
    <span
      className={cx(
        'ui-status-badge',
        tone === 'info' && 'ui-status-info',
        tone === 'success' && 'ui-status-success',
        tone === 'warning' && 'ui-status-warning',
        tone === 'danger' && 'ui-status-danger',
        className
      )}
    >
      {children}
    </span>
  );
}

export function ActionButton({
  children,
  className,
  variant = 'secondary',
  block = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
}) {
  return (
    <button
      className={cx(
        'ui-action-button',
        variant === 'primary' && 'ui-action-primary',
        variant === 'secondary' && 'ui-action-secondary',
        variant === 'ghost' && 'ui-action-ghost',
        variant === 'danger' && 'ui-action-danger',
        block && 'w-full justify-center',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard tone="soft" className={cx('px-4 py-4', className)}>
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
      {detail ? <div className="mt-2 text-xs leading-6 text-[var(--text-soft)]">{detail}</div> : null}
    </SurfaceCard>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('ui-input', props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('ui-input ui-textarea', props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('ui-input', props.className)} />;
}

export function FieldLabel({
  label,
  hint,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1', className)}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-faint)]">{label}</div>
      {hint ? <div className="text-xs leading-6 text-[var(--text-faint)]">{hint}</div> : null}
    </div>
  );
}

export function InlineHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('text-xs leading-6 text-[var(--text-faint)]', className)}>{children}</div>;
}

export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('ui-empty-state', className)}>{children}</div>;
}

export function ProgressMeter({
  value,
  max = 10,
  className,
  fillClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  fillClassName?: string;
}) {
  const safeMax = max <= 0 ? 1 : max;
  const ratio = Math.max(0, Math.min(1, value / safeMax));

  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-white/8', className)}>
      <div
        className={cx('h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#60a5fa)] transition-[width] duration-300', fillClassName)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export { cx };
