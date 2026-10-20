import { useBestTimesHeatmap } from '../../../hooks/useBestTimesHeatmap';
import { useNow } from '../../../hooks/useNow';
import { suggestStudyWindow } from '../../../lib/studyWindow';
import { useI18n } from '../../../i18n/useI18n';

// O heatmap vem em horas do servidor (UTC); mostra-se na hora local de quem le.
function utcHourToLocalLabel(utcHour: number, now: Date): string {
  const moment = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour));
  return moment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Uma linha que diz se esta e uma das tuas boas horas. So aparece com
// sessoes que cheguem (ver MIN_SESSIONS_FOR_HINT): antes disso nao ha padrao.
export default function StudyNowHint() {
  const { t } = useI18n();
  const { cells } = useBestTimesHeatmap();
  const now = useNow();
  const hint = suggestStudyWindow(cells, now);
  if (!hint) return null;

  return (
    <p className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-3 py-2 text-sm text-violet-200">
      {hint.kind === 'now'
        ? t('ui.productiveWindowNow')
        : t('ui.bestWindowLeftToday', { start: utcHourToLocalLabel(hint.startHour, now), end: utcHourToLocalLabel(hint.endHour, now) })}
    </p>
  );
}
