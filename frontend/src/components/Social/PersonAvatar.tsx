const SIZE_CLASS = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-xl',
} as const;

interface PersonAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: keyof typeof SIZE_CLASS;
}

// Foto da pessoa, ou a inicial do nome quando nao ha foto.
export default function PersonAvatar({ name, avatarUrl, size = 'md' }: PersonAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${SIZE_CLASS[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZE_CLASS[size]} flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-medium text-neutral-300`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
