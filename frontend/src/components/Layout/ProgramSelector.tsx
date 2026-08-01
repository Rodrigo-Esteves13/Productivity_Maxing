import { useState } from 'react';
import Select from '../UI/Select';
import { TrashIcon, PencilIcon } from '../UI/Icons';
import { useAcademic } from '../../context/useAcademic';
import CreateProgramModal from './CreateProgramModal';
import RenameProgramModal from './RenameProgramModal';
import ManagePeriodsModal from './ManagePeriodsModal';

const CREATE_NEW_VALUE = '__create_new__';
const NO_PROGRAM_VALUE = '__no_program__';

export default function ProgramSelector() {
  const {
    programs,
    activeProgram,
    isViewingAllPrograms,
    viewAllPrograms,
    switchProgram,
    createProgram,
    removeProgram,
    refresh,
    isLoading,
  } = useAcademic();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Nothing to pick with a single program yet - but it's still worth
  // showing the selector with the option to create a second one, so we
  // only hide it while loading.
  if (isLoading) return null;

  const handleChange = (value: string) => {
    if (value === CREATE_NEW_VALUE) {
      setIsCreateModalOpen(true);
      return;
    }
    if (value === NO_PROGRAM_VALUE) {
      viewAllPrograms();
      return;
    }
    switchProgram(value);
  };

  const handleDelete = async () => {
    if (!activeProgram) return;
    if (
      !window.confirm(
        `Delete "${activeProgram.name}" permanently? This can't be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await removeProgram(activeProgram.id);
    } catch (err: any) {
      // 409 = the backend refused because this program still has tasks in
      // it (see ProgramsService.remove on the backend) - move or delete
      // those tasks first.
      const message =
        err?.response?.data?.message ??
        'Could not delete the program. It may still have tasks in it.';
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Select
        aria-label="Active program"
        className="w-auto min-w-[220px]"
        value={isViewingAllPrograms ? NO_PROGRAM_VALUE : (activeProgram?.id ?? '')}
        onChange={(e) => handleChange(e.target.value)}
      >
        {programs
          .filter((p) => p.isActive || p.id === activeProgram?.id)
          .map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        <option value={NO_PROGRAM_VALUE}>No program (all tasks)</option>
        <option value={CREATE_NEW_VALUE}>+ Create new program</option>
      </Select>

      {activeProgram && (
        <>
          <button
            type="button"
            onClick={() => setIsRenameModalOpen(true)}
            title="Rename program"
            className="text-neutral-500 hover:text-neutral-200 transition-colors p-1.5"
          >
            <PencilIcon />
          </button>

          <button
            type="button"
            onClick={() => setIsPeriodsModalOpen(true)}
            className="text-sm text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
          >
            Manage periods
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete program"
            className="text-neutral-500 hover:text-red-500 transition-colors p-1.5 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
        </>
      )}

      <CreateProgramModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createProgram}
      />

      {activeProgram && (
        <>
          <RenameProgramModal
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            program={activeProgram}
            onRenamed={refresh}
          />
          <ManagePeriodsModal
            isOpen={isPeriodsModalOpen}
            onClose={() => setIsPeriodsModalOpen(false)}
            program={activeProgram}
          />
        </>
      )}
    </>
  );
}
