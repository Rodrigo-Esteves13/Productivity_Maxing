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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-syncs the field every time a different program's modal opens.
  useEffect(() => {
    if (isOpen) setName(program.name);
  }, [isOpen, program.name]);

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
      await updateProgram(program.id, { name: name.trim() });
      onRenamed();
      handleClose();
    } catch {
      setError('Could not rename the program. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Rename program">
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
