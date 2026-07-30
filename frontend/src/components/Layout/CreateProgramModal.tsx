import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, roundFinalGrade?: boolean) => Promise<void>;
}

export default function CreateProgramModal({ isOpen, onClose, onCreate }: CreateProgramModalProps) {
  const [name, setName] = useState('');
  const [roundFinalGrade, setRoundFinalGrade] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setRoundFinalGrade(true);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim(), roundFinalGrade);
      handleClose();
    } catch {
      setError('Could not create the program. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create new program">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-400">
          A separate new dashboard (e.g. "Master's", "High School") - gets its
          own active period, without mixing with the rest.
        </p>

        <FormField label="Program name" htmlFor="program-name">
          <Input
            id="program-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bachelor's in Computer Science"
            autoFocus
            required
          />
        </FormField>

        <label
          htmlFor="program-round-final-grade"
          className="flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 cursor-pointer"
        >
          <input
            id="program-round-final-grade"
            type="checkbox"
            checked={roundFinalGrade}
            onChange={(e) => setRoundFinalGrade(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-neutral-900"
          />
          <span>
            <span className="block text-sm text-neutral-200">
              Round each subject's final grade
            </span>
            <span className="block text-xs text-neutral-500">
              Rounds each subject to the nearest whole number before
              computing the credit-weighted average - matches how most
              universities record final grades. Individual periods can
              override this later.
            </span>
          </span>
        </label>

        {error && <FormError message={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating...' : 'Create program'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
