import { useCallback, useState } from 'react';
import { getSecurityActivityExport } from '../../api/userService';
import { DownloadIcon } from '../UI/Icons';
import { securityActivityToCsv } from '../../utils/securityActivityCsv';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { todayKey } from '../../lib/dateKey';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const FILE_PREFIX = 'pmaxing_security_activity_';

// "Download my security activity": sessoes (incluindo as terminadas ainda
// guardadas), eventos de seguranca e a data do 2FA, so desta conta.
export default function SecurityActivityExportButton() {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getSecurityActivityExport();
      downloadTextFile(securityActivityToCsv(data, t), `${FILE_PREFIX}${todayKey()}.csv`, CSV_MIME_TYPE);
      // O servidor tem teto por lista: avisar em vez de entregar um ficheiro parcial em silencio.
      if (data.sessionsTruncated || data.eventsTruncated) notify(t('securityExport.truncated'), 'info');
    } catch {
      notify(t('securityExport.error'), 'error');
    } finally {
      setBusy(false);
    }
  }, [notify, t]);

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      title={t('securityExport.hint')}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50"
    >
      <DownloadIcon className="h-4 w-4" aria-hidden="true" />
      {busy ? t('securityExport.busy') : t('securityExport.button')}
    </button>
  );
}
