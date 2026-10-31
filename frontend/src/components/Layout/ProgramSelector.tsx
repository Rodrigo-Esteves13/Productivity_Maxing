import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Select from '../UI/Select';
import { TrashIcon, PencilIcon, SlidersIcon } from '../UI/Icons';
import { useAcademic } from '../../context/useAcademic';
import { getApiMessage } from '../../lib/httpError';
import CreateProgramModal from './CreateProgramModal';
import RenameProgramModal from './RenameProgramModal';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

// Lazy e montado so quando aberto.
const ManagePeriodsModal = lazy(() => import('./ManagePeriodsModal'));
const ApprovalRulesModal = lazy(() => import('../ApprovalRules/ApprovalRulesModal'));

// Deep link usado pela paleta de comandos: /dashboard?approvalRules=on
const APPROVAL_RULES_PARAM = 'approvalRules';

const CREATE_NEW_VALUE = '__create_new__';
const NO_PROGRAM_VALUE = '__no_program__';

export default function ProgramSelector() {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
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
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsRules = searchParams.has(APPROVAL_RULES_PARAM);

  useEffect(() => {
    if (!wantsRules || !activeProgram) return;
    setIsRulesModalOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(APPROVAL_RULES_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [wantsRules, activeProgram, setSearchParams]);

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
    const confirmed = await confirm({
      title: t('program.delete.title'),
      message: t('program.delete.message', { name: activeProgram.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await removeProgram(activeProgram.id);
    } catch (err: unknown) {
      // 409 = the backend refused because this program still has tasks in
      // it (see ProgramsService.remove on the backend) - move or delete
      // those tasks first.
      const message = getApiMessage(err, t('program.delete.error'));
      notify(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Select
        aria-label={t('program.active')}
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
        <option value={NO_PROGRAM_VALUE}>{t('program.none')}</option>
        <option value={CREATE_NEW_VALUE}>{t('program.createNew')}</option>
      </Select>

      {activeProgram && (
        <>
          <IconButton
            label={t('program.rename')}
            onClick={() => setIsRenameModalOpen(true)}
            className="text-neutral-500 hover:text-neutral-200"
          >
            <PencilIcon />
          </IconButton>

          <IconButton
            label={t('approvalRules.open')}
            onClick={() => setIsRulesModalOpen(true)}
            className="text-neutral-500 hover:text-neutral-200"
          >
            <SlidersIcon />
          </IconButton>

          <button
            type="button"
            onClick={() => setIsPeriodsModalOpen(true)}
            className="text-sm text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
          >
            {t('program.managePeriods')}
          </button>

          <IconButton
            label={t('program.delete.title')}
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-neutral-500 hover:text-red-500 disabled:opacity-50"
          >
            <TrashIcon />
          </IconButton>
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
          {isRulesModalOpen && (
            <Suspense fallback={null}>
              <ApprovalRulesModal
                isOpen
                onClose={() => setIsRulesModalOpen(false)}
                scope="program"
                targetId={activeProgram.id}
                targetName={activeProgram.name}
              />
            </Suspense>
          )}
          {isPeriodsModalOpen && (
            <Suspense fallback={null}>
              <ManagePeriodsModal
                isOpen
                onClose={() => setIsPeriodsModalOpen(false)}
                program={activeProgram}
              />
            </Suspense>
          )}
        </>
      )}
    </>
  );
}
