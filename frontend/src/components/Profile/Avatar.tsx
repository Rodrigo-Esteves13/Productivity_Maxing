import { isSafeImageUrl } from '../../utils/isSafeImageUrl';

interface AvatarProps {
  initials: string;
  avatarUrl?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-16 w-16 text-xl',
  lg: 'h-24 w-24 text-3xl',
};

export default function Avatar({ initials, avatarUrl, alt = 'Avatar', size = 'md' }: AvatarProps) {
  if (isSafeImageUrl(avatarUrl)) {
    return (
      <img
        src={avatarUrl}
        alt={alt}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-neutral-700 shadow-lg flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg flex-shrink-0`}
    >
      {initials.toUpperCase()}
    </div>
  );
}
