import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFinanceExport } from '../../api/financeService';
import Button from '../UI/Button';
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
      notify(t(data.truncated ? 'financeFixes.export.truncated' : 'ux4fin.exportDone'), data.truncated ? 'info' : 'success');
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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void run()}
      disabled={busy}
      aria-busy={busy}
      title={t('financeExport.hint')}
      className="inline-flex items-center gap-2"
    >
      <DownloadIcon className="h-4 w-4" />
      {t('financeExport.button')}
    </Button>
  );
}
