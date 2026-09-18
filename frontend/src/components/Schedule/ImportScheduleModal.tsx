import { useRef, useState, type ChangeEvent } from 'react';
import Modal from '../UI/Modal';
import { useScheduleImport } from '../../hooks/useScheduleImport';
import { CheckIcon, AlertTriangleIcon } from '../UI/Icons';

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
  const { stage, outcome, errorMessage, runImport, reset } = useScheduleImport();
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasNotifiedRef = useRef(false);

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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import schedule from .ics">
      <div className="space-y-4">
        <div className="text-sm text-neutral-400 space-y-1">
          <p>
            Export your timetable as .ics from the UMaia student portal and upload it here. Each
            class is matched by its own event ID, so re-importing (e.g. a new export a few weeks
            later) updates existing classes and adds new ones - it never creates duplicates.
          </p>
          <p>
            The export only covers a rolling window (usually 2-3 weeks) - re-import periodically
            to keep the schedule filled in further ahead.
          </p>
        </div>

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
            {stage === 'reading' ? `Reading ${fileName}...` : 'Saving classes...'}
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
                <CheckIcon className="text-emerald-400 shrink-0" />
                <span className="text-neutral-200">
                  {outcome.backendResult.imported} class
                  {outcome.backendResult.imported === 1 ? '' : 'es'} imported
                  {outcome.backendResult.failed > 0 && `, ${outcome.backendResult.failed} failed`}.
                </span>
              </div>
            )}

            {(outcome.parseErrors.length > 0 ||
              (outcome.backendResult?.results.some((r) => !r.success) ?? false)) && (
              <div className="max-h-48 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                  Events skipped
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
                      Row {r.row}: {r.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
