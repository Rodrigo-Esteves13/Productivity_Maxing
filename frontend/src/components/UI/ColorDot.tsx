type ColorDotVariant = 'circle' | 'square';
type ColorDotSize = 'xs' | 'sm' | 'md';

interface ColorDotProps {
  color: string;
  variant?: ColorDotVariant;
  size?: ColorDotSize;
  className?: string;
}

const sizeClasses: Record<ColorDotSize, string> = {
  xs: 'w-2 h-2',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

export default function ColorDot({ color, variant = 'circle', size = 'sm', className = '' }: ColorDotProps) {
  const shapeClasses = variant === 'circle' ? 'rounded-full' : 'rounded border border-neutral-700';

  return (
    <span
      aria-hidden="true"
      className={`inline-block ${sizeClasses[size]} ${shapeClasses} flex-shrink-0 shadow-sm ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
