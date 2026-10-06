import { useState } from 'react';
import Button from '../../UI/Button';
import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import RatingInput from '../../UI/RatingInput';

export interface StopDetails {
  note?: string;
  focusRating?: number;
  markTaskDone: boolean;
}

interface StopSessionPanelProps {
  // Titulo da task ligada, se houver (so ai faz sentido "marcar como feita").
  taskTitle: string | null;
  isSubmitting: boolean;
  onConfirm: (details: StopDetails) => void;
  onCancel: () => void;
}

// Ao parar: nota, concentracao (1 a 5) e, se ha task, "ja terminei". Tudo
// opcional: dá para guardar sem responder a nada.
export default function StopSessionPanel({ taskTitle, isSubmitting, onConfirm, onCancel }: StopSessionPanelProps) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [markDone, setMarkDone] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Note (optional)" htmlFor="stop-note">
        <Input
          id="stop-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you study?"
          maxLength={500}
        />
      </FormField>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-300">How focused were you? (optional)</p>
        <RatingInput value={rating} onChange={setRating} hint="1 = scattered, 5 = fully focused" />
      </div>

      {taskTitle && (
        <label className="flex items-start gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={markDone}
            onChange={(e) => setMarkDone(e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <span>
            I finished <span className="text-white">{taskTitle}</span>
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={isSubmitting}
          onClick={() =>
            onConfirm({
              note: note.trim() || undefined,
              focusRating: rating ?? undefined,
              markTaskDone: markDone,
            })
          }
        >
          {isSubmitting ? 'Saving...' : 'Save session'}
        </Button>
        <Button variant="secondary" disabled={isSubmitting} onClick={onCancel}>
          Keep going
        </Button>
      </div>
    </div>
  );
}
