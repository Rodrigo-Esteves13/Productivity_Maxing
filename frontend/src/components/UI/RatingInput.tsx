import ToggleChip from './ToggleChip';

const LEVELS = [1, 2, 3, 4, 5] as const;

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  // Texto explicativo por baixo (ex: "1 = scattered, 5 = fully focused").
  hint?: string;
}

// Escala de 1 a 5. Clicar no valor ja escolhido volta a deixar em branco,
// porque responder e sempre opcional.
export default function RatingInput({ value, onChange, hint }: RatingInputProps) {
  return (
    <div>
      <div role="group" aria-label="Rating from 1 to 5" className="flex gap-1.5">
        {LEVELS.map((level) => (
          <ToggleChip key={level} size="sm" pressed={value === level} onClick={() => onChange(value === level ? null : level)}>
            {level}
          </ToggleChip>
        ))}
      </div>
      {hint && <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}
