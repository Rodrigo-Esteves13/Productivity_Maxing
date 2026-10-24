import { useRef, useState, type ChangeEvent } from 'react';
import Modal from '../UI/Modal';
import { useScheduleImport } from '../../hooks/useScheduleImport';
import { CheckIcon, AlertTriangleIcon, TrashIcon } from '../UI/Icons';
import { deleteImportedClasses } from '../../api/scheduleService';
import { useFeedback } from '../../context/useFeedback';
import ImportOptionsPanel from './ImportOptionsPanel';
import { useI18n } from '../../i18n/useI18n';

interface ImportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Chamado assim que pelo menos uma ocorrência é importada, para o
  // pai (Schedule.tsx) recarregar a semana atual - mesma ideia de
  // TaskImportModal.onImported.
  onImported: () => void;
}

const ACCEPTED_EXTENSIONS = '.ics';

export default function ImportScheduleModal({
  isOpen,
  onClose,
  onImported,
}: ImportScheduleModalProps) {
  const { t } = useI18n();
  const { stage, outcome, errorMessage, runImport, reset, options, setOptions } = useScheduleImport();
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasNotifiedRef = useRef(false);
  const { confirm, notify } = useFeedback();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClose = () => {
    reset();
    setFileName(null);
    hasNotifiedRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    hasNotifiedRef.current = false;
    await runImport(file);
  };

  if (
    stage === 'done' &&
    outcome?.backendResult &&
    outcome.backendResult.imported > 0 &&
    !hasNotifiedRef.current
  ) {
    hasNotifiedRef.current = true;
    onImported();
  }

  const isBusy = stage === 'reading' || stage === 'importing';

  // Importaste o horario errado? Apaga tudo e importa de novo. Turnos,
  // locais e apontamentos do caderno nao sao tocados.
  const handleDeleteAll = async () => {
    const ok = await confirm({
      title: t('ui.deleteImportedClasses'),
      message:
        t('ui.thisRemovesEveryClassImported'),
      confirmLabel: t('ui.deleteClasses'),
      tone: 'danger',
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      const { deleted } = await deleteImportedClasses();
      notify(t(deleted === 1 ? 'ui.importedClassesDeletedOne' : 'ui.importedClassesDeletedMany', { count: deleted }), 'success');
      // Refaz a grelha/plano e propoe limpar o Google Calendar (se ligado).
      onImported();
      handleClose();
    } catch {
      notify(t('ui.couldNotDeleteTheImported'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('ui.importScheduleFromIcs')}>
      <div className="space-y-4">
        <div className="text-sm text-neutral-400 space-y-1">
          <p>
            {t('ui.exportYourTimetableAsIcs')}
          </p>
          <p>
            {t('ui.theExportOnlyCoversA')}
          </p>
        </div>

        <ImportOptionsPanel options={options} onChange={setOptions} disabled={isBusy} />

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          disabled={isBusy}
          className="block w-full text-sm text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:text-sm file:font-medium hover:file:bg-violet-500 disabled:opacity-50"
        />

        {isBusy && (
          <p className="text-sm text-neutral-400">
            {stage === 'reading' ? t('ui.readingFile', { name: fileName ?? '' }) : t('ui.savingClasses')}
          </p>
        )}

        {stage === 'error' && errorMessage && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3">
            <AlertTriangleIcon className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {outcome && (
          <div className="space-y-3">
            {outcome.backendResult && (
              <div className="flex items-center gap-2 text-sm">
                <CheckIcon className="text-violet-400 shrink-0" />
                <span className="text-neutral-200">
                  {t(outcome.backendResult.imported === 1 ? 'ui.classesImportedOne' : 'ui.classesImportedMany', {
                    count: outcome.backendResult.imported,
                  })}
                  {outcome.backendResult.failed > 0 && t('ui.tasksFailedSuffix', { count: outcome.backendResult.failed })}
                  {(outcome.backendResult.removed ?? 0) > 0 &&
                    t('ui.outdatedReplacedSuffix', { count: outcome.backendResult.removed ?? 0 })}.
                </span>
              </div>
            )}

            {(outcome.parseErrors.length > 0 ||
              (outcome.backendResult?.results.some((r) => !r.success) ?? false)) && (
              <div className="max-h-48 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                  {t('ui.eventsSkipped')}
                </p>
                {outcome.parseErrors.map((message, i) => (
                  <p key={`parse-${i}`} className="text-xs text-neutral-400">
                    {message}
                  </p>
                ))}
                {outcome.backendResult?.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <p key={`backend-${r.row}`} className="text-xs text-neutral-400">
                      {t('ui.row2', { row: r.row, error: r.error ?? '' })}</p>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 mt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={() => void handleDeleteAll()}
            disabled={isBusy || isDeleting}
            className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            <TrashIcon width={14} height={14} />
            {isDeleting ? t('ui.deleting') : t('ui.deleteAllImportedClasses')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
