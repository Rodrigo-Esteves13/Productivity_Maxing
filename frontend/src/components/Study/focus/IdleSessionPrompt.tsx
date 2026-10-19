import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useIdleSession } from '../../../hooks/useIdleSession';
import { useStopSession } from '../../../hooks/useStopSession';
import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// "Ainda estas a estudar?" depois de muito tempo sem mexer na app. Nunca
// para sozinho: a pessoa decide se continua ou se corta a sessao na hora
// da ultima atividade (o tempo parado nao entra nas previsoes).
export default function IdleSessionPrompt() {
  const { t } = useI18n();
  const { activeSession, isSubmitting } = useActiveStudySession();
  const { idleSince, stillHere } = useIdleSession();
  const { stopSession } = useStopSession();

  if (!activeSession || idleSince === null) return null;

  // So se pode cortar la atras se a ultima atividade foi depois de a sessao comecar.
  const canCutAtLastActivity = idleSince > new Date(activeSession.startedAt).getTime();

  return (
    <div role="alertdialog" aria-label={t('ui.stillStudying')} className="rounded-xl border border-amber-700/60 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-medium text-white">{t('ui.stillStudying')}</p>
      <p className="mt-1 text-xs text-neutral-400">{t('ui.noActivitySince', { idleSince: clock(idleSince) })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" className="px-3 py-1.5 text-sm" onClick={stillHere}>
          {t('ui.iMStillHere')}
        </Button>
        {canCutAtLastActivity && (
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            disabled={isSubmitting}
            onClick={() => void stopSession({ endedAt: new Date(idleSince).toISOString() })}
          >
            {t('ui.stopAt', { idleSince: clock(idleSince) })}</Button>
        )}
        <Button variant="secondary" className="px-3 py-1.5 text-sm" disabled={isSubmitting} onClick={() => void stopSession()}>
          {t('ui.stopNow')}
        </Button>
      </div>
    </div>
  );
}
