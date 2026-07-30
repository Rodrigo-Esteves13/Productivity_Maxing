import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { updateProgram } from '../../api/academicService';
import type { AcademicProgram } from '../../types/models';

interface RenameProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: AcademicProgram;
  onRenamed: () => void;
}

export default function RenameProgramModal({
  isOpen,
  onClose,
  program,
  onRenamed,
}: RenameProgramModalProps) {
  const [name, setName] = useState(program.name);
  const [roundFinalGrade, setRoundFinalGrade] = useState(program.roundFinalGrade);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-syncs the fields every time a different program's modal opens.
  useEffect(() => {
    if (isOpen) {
      setName(program.name);
      setRoundFinalGrade(program.roundFinalGrade);
    }
  }, [isOpen, program.name, program.roundFinalGrade]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await updateProgram(program.id, { name: name.trim(), roundFinalGrade });
      onRenamed();
      handleClose();
    } catch {
      setError('Could not save the program. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Program settings">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Program name" htmlFor="rename-program-name">
          <Input
            id="rename-program-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </FormField>

        <label
          htmlFor="rename-program-round-final-grade"
          className="flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 cursor-pointer"
        >
          <input
            id="rename-program-round-final-grade"
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
              Default for every period in this program. A period can still
              override it individually.
            </span>
          </span>
        </label>

        {error && <FormError message={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
