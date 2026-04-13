import { resolveAgentAvatarPreset } from '@/lib/agents/avatar-presets';
import { cx } from '@/components/ui/console-kit';

export function AgentAvatar({
  avatarUrl,
  seed,
  name,
  size = 'md',
  className,
}: {
  avatarUrl?: string | null;
  seed: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const preset = resolveAgentAvatarPreset(avatarUrl, seed);
  const sizeClass =
    size === 'sm'
      ? 'h-10 w-10 rounded-[14px] p-[3px]'
      : size === 'lg'
        ? 'h-16 w-16 rounded-[22px] p-[4px]'
        : size === 'xl'
          ? 'h-20 w-20 rounded-[26px] p-[4px]'
          : 'h-12 w-12 rounded-[18px] p-[3px]';

  const innerRadius =
    size === 'sm' ? 'rounded-[11px]' : size === 'lg' ? 'rounded-[18px]' : size === 'xl' ? 'rounded-[22px]' : 'rounded-[15px]';

  return (
    <div
      className={cx('shrink-0 overflow-hidden', sizeClass, className)}
      style={{
        background: preset.palette.avatarShell,
        boxShadow: `0 14px 30px ${preset.palette.shadow}`,
      }}
      aria-label={`${name} avatar`}
      title={preset.name}
    >
      <div className={cx('h-full w-full overflow-hidden', innerRadius)} style={{ background: preset.palette.avatarInner }}>
        <img src={preset.imageUrl} alt={`${name} avatar`} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}
