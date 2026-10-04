type SwatchSize = 'sm' | 'md';

interface ColorSwatchesProps {
  colors: readonly string[];
  selected: string | null | undefined;
  onSelect: (color: string) => void;
  // Texto do aria-label, ex: "Use color" -> "Use color #B91C1C".
  labelPrefix: string;
  size?: SwatchSize;
}

const SIZE_CLASS: Record<SwatchSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
};

// Fila de bolinhas de cor clicaveis (traco e texto do canvas).
export default function ColorSwatches({ colors, selected, onSelect, labelPrefix, size = 'md' }: ColorSwatchesProps) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${labelPrefix} ${color}`}
          onClick={() => onSelect(color)}
          className={`${SIZE_CLASS[size]} rounded-full border-2 transition-transform ${
            selected === color ? 'scale-110 border-violet-400' : 'border-neutral-700'
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
