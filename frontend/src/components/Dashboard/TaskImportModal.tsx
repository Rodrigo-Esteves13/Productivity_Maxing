import { useRef, useState, type ChangeEvent } from 'react';
import Modal from '../UI/Modal';
import { useTaskImport } from '../../hooks/useTaskImport';
import { CheckIcon, AlertTriangleIcon } from '../UI/Icons';

interface TaskImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Called once at least one task was created, so the caller (Dashboard)
  // can refetch its task list - the modal itself has no reason to know
  // how the parent loads tasks.
  onImported: () => void;
}

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv';

export default function TaskImportModal({ isOpen, onClose, onImported }: TaskImportModalProps) {
  const { stage, outcome, errorMessage, runImport, reset } = useTaskImport();
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

  // Notify the parent as soon as we know at least one task was created -
  // not on every render, just once per successful import.
  if (stage === 'done' && outcome?.backendResult && outcome.backendResult.created > 0 && !hasNotifiedRef.current) {
    hasNotifiedRef.current = true;
    onImported();
  }

  const isBusy = stage === 'reading' || stage === 'importing';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import tasks from Excel/CSV">
      <div className="space-y-4">
        <div className="text-sm text-neutral-400 space-y-1">
          <p>
            Upload a .xlsx, .xls, or .csv file with one row per task. Expected columns: Title, Date, Area,
            Period, Type, Academic Type, Weight %, Difficulty, Status, Target Grade, Real Grade, Topics.
          </p>
          <p>
            Only <span className="text-neutral-300">Title</span>, <span className="text-neutral-300">Date</span>, and{' '}
            <span className="text-neutral-300">Area</span> are required - Area must match one of your existing
            areas exactly by name. <span className="text-neutral-300">Period</span> is optional and lets you
            import into a specific past/future semester by name instead of the currently active one.
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
            {stage === 'reading' ? `Reading ${fileName}...` : 'Creating tasks...'}
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
                  {outcome.backendResult.created} task{outcome.backendResult.created === 1 ? '' : 's'} created
                  {outcome.backendResult.failed > 0 && `, ${outcome.backendResult.failed} failed`}.
                </span>
              </div>
            )}

            {(outcome.parseErrors.length > 0 ||
              (outcome.backendResult?.results.some((r) => !r.success) ?? false)) && (
              <div className="max-h-48 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Rows skipped</p>
                {outcome.parseErrors.map((e) => (
                  <p key={`parse-${e.row}`} className="text-xs text-neutral-400">
                    Row {e.row}: {e.message}
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
