import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import EmptyState from '../UI/EmptyState';
import { AlertTriangleIcon, CheckIcon, UploadIcon } from '../UI/Icons';
import { FINANCE_ACCOUNT_NAME_MAX_LENGTH, FINANCE_MAX_ENTRIES_PER_USER, FINANCE_NOTE_MAX_LENGTH } from '../../api/financeService';
import { FINANCE_IMPORT_MAX_FILE_MB, useFinanceImport } from '../../hooks/useFinanceImport';
import type { FinanceImportError } from '../../utils/financeCsv';
import type { TranslateVars } from '../../i18n/i18n-context';
import { useI18n } from '../../i18n/useI18n';

// Paleta de comandos: /finance?import=csv abre o modal uma vez.
const IMPORT_PARAM = 'import';
const IMPORT_CSV_VALUE = 'csv';
const ACCEPTED_FILES = '.csv,text/csv';
// A lista de linhas com erro mostra no maximo estas; o resto vira "e mais N".
const MAX_ERRORS_SHOWN = 50;
const REASON_VARS: Partial<Record<FinanceImportError, TranslateVars>> = {
  NOTE: { max: FINANCE_NOTE_MAX_LENGTH },
  ACCOUNT: { max: FINANCE_ACCOUNT_NAME_MAX_LENGTH },
};

interface FinanceImportButtonProps {
  /** Corre depois de pelo menos uma linha importada (recarrega a pagina). */
  onImported: () => void | Promise<void>;
}

// Importa o CSV do proprio export: le no browser, mostra a pre-visualizacao
// (validas, duplicadas, com erro, teto) e so escreve depois de confirmar.
export default function FinanceImportButton({ onImported }: FinanceImportButtonProps) {
  const { t } = useI18n();
  const { stage, preview, progress, result, errorKey, pickFile, confirm, reset } = useFinanceImport();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);
  const busy = stage === 'reading' || stage === 'importing';

  const close = useCallback(() => {
    if (busy) return;
    reset();
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpen(false);
  }, [busy, reset]);

  const requested = searchParams.get(IMPORT_PARAM) === IMPORT_CSV_VALUE;
  useEffect(() => {
    if (!requested) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(IMPORT_PARAM);
      return next;
    }, { replace: true });
    setOpen(true);
  }, [requested, setSearchParams]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    void pickFile(file);
  };

  const handleConfirm = async () => {
    const total = await confirm();
    if (total && total.imported > 0) await onImported();
  };

  const importable = preview ? Math.min(preview.fresh, preview.room) : 0;
  const summary = preview
    ? [
        { key: 'valid', count: preview.fresh },
        { key: 'duplicates', count: preview.duplicates },
        { key: 'errors', count: preview.errors.length },
        { key: 'informational', count: preview.informational },
        { key: 'owed', count: preview.owedAsPlain },
      ].filter((item) => item.key === 'valid' || item.count > 0)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('financeImport.hint')}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <UploadIcon className="h-4 w-4" />
        {t('financeImport.button')}
      </button>
      <Modal isOpen={open} onClose={close} title={t('financeImport.title')}>
        <div className="space-y-4 text-sm">
          <div className="space-y-1 text-neutral-400">
            <p>{t('financeImport.intro')}</p>
            <p>{t('financeImport.owedNote')}</p>
            <p>{t('financeImport.accountNote')}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            onChange={handleFile}
            disabled={busy}
            aria-label={t('financeImport.chooseFile')}
            className="block w-full text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500 disabled:opacity-50"
          />

          {stage === 'reading' && (
            <p role="status" className="text-neutral-400">{t('financeImport.reading', { name: fileName })}</p>
          )}
          {stage === 'importing' && (
            <p role="status" className="text-neutral-400">
              {t('financeImport.importing', { sent: progress.sent, total: progress.total })}
            </p>
          )}

          {stage === 'error' && errorKey && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-red-400">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <span>
                {t(`financeImport.error.${errorKey}`, { max: FINANCE_IMPORT_MAX_FILE_MB, imported: result?.imported ?? 0 })}
              </span>
            </div>
          )}

          {stage === 'done' && result && (
            <div role="status" className="flex items-center gap-2 text-neutral-200">
              <CheckIcon className="shrink-0 text-violet-400" />
              <span>{t('financeImport.done', { imported: result.imported, skipped: result.skipped })}</span>
            </div>
          )}

          {preview && (stage === 'preview' || stage === 'importing') && (
            <div className="space-y-3">
              <ul className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-neutral-300">
                {summary.map((item) => (
                  <li key={item.key}>{t(`financeImport.summary.${item.key}`, { count: item.count })}</li>
                ))}
              </ul>

              {preview.fresh === 0 && <EmptyState variant="inline" message={t('financeImport.empty')} />}

              {preview.fresh > preview.room && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 text-amber-300">
                  <AlertTriangleIcon className="mt-0.5 shrink-0" />
                  <span>{t('financeImport.overLimit', { room: preview.room, max: FINANCE_MAX_ENTRIES_PER_USER })}</span>
                </p>
              )}

              {preview.errors.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{t('financeImport.errorsTitle')}</p>
                  {preview.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                    <p key={e.row} className="text-xs text-neutral-400">
                      {t('financeImport.errorRow', { row: e.row, reason: t(`financeImport.reason.${e.error}`, REASON_VARS[e.error]) })}
                    </p>
                  ))}
                  {preview.errors.length > MAX_ERRORS_SHOWN && (
                    <p className="text-xs text-neutral-500">{t('financeImport.moreErrors', { count: preview.errors.length - MAX_ERRORS_SHOWN })}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={close} disabled={busy}>
              {t(stage === 'done' ? 'common.close' : 'common.cancel')}
            </Button>
            {(stage === 'preview' || stage === 'importing') && (
              <Button type="button" size="sm" onClick={() => void handleConfirm()} disabled={busy || importable === 0}>
                {t('financeImport.confirm', { count: importable })}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
