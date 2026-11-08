import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFinanceExport } from '../../api/financeService';
import { DownloadIcon } from '../UI/Icons';
import { FINANCE_CSV_COLUMNS, financeToCsv } from '../../utils/financeCsv';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { todayKey } from '../../lib/dateKey';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

// Paleta de comandos: /finance?export=csv descarrega o CSV uma vez.
const EXPORT_PARAM = 'export';
const EXPORT_CSV_VALUE = 'csv';

// Exporta todo o historico (nao so o mes mostrado), via GET /finance/export.
// E uma acao explicita, por isso ignora o modo privacidade.
export default function FinanceExportButton() {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getFinanceExport();
      const csv = financeToCsv(data, {
        headers: FINANCE_CSV_COLUMNS.map((key) => t(`financeExport.col.${key}`)),
        paymentNote: t('financeExport.paymentNote'),
      });
      downloadTextFile(csv, `pmaxing_money_${todayKey()}.csv`, 'text/csv;charset=utf-8');
      // The server caps each list; say so instead of handing over a partial file silently.
      if (data.truncated) notify(t('financeFixes.export.truncated'), 'info');
    } catch {
      notify(t('financeExport.error'), 'error');
    } finally {
      setBusy(false);
    }
  }, [notify, t]);

  const requested = searchParams.get(EXPORT_PARAM) === EXPORT_CSV_VALUE;
  useEffect(() => {
    if (!requested) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(EXPORT_PARAM);
      return next;
    }, { replace: true });
    void run();
  }, [requested, run, setSearchParams]);

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      title={t('financeExport.hint')}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50"
    >
      <DownloadIcon className="h-4 w-4" />
      {t('financeExport.button')}
    </button>
  );
}
