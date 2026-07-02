interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ initials, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-16 w-16 text-xl',
    lg: 'h-24 w-24 text-3xl'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg`}>
      {initials.toUpperCase()}
    </div>
  );
}