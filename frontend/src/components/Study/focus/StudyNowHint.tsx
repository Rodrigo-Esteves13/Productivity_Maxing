import { useBestTimesHeatmap } from '../../../hooks/useBestTimesHeatmap';
import { useNow } from '../../../hooks/useNow';
import { suggestStudyWindow } from '../../../lib/studyWindow';
import { computeFocusHours, FOCUS_HOURS_RATE_DECIMALS, formatFocusHour } from '../../../lib/focusHours';
import type { DistractionStats } from '../../../api/studySessionsService';
import { useI18n } from '../../../i18n/useI18n';

// O heatmap vem em horas do servidor (UTC); mostra-se na hora local de quem le.
function utcHourToLocalLabel(utcHour: number, now: Date): string {
  const moment = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour));
  return moment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Uma linha que diz se esta e uma das tuas boas horas. So aparece com
// sessoes que cheguem (ver MIN_SESSIONS_FOR_HINT): antes disso nao ha padrao.
interface Props {
  // Partilhado com o cartao de distracoes (um so pedido). Sem dados: so a dica do heatmap.
  distractionStats?: DistractionStats | null;
}

export default function StudyNowHint({ distractionStats = null }: Props) {
  const { t, lang } = useI18n();
  const { cells } = useBestTimesHeatmap();
  const now = useNow();
  const hint = suggestStudyWindow(cells, now);
  const focus = distractionStats ? computeFocusHours(distractionStats.byHour, now) : null;
  if (!hint && !focus) return null;

  const focusLine = !focus
    ? null
    : focus.nowIsWorst
      ? t('focusHours.worst', { hour: formatFocusHour(focus.worstHour, lang) })
      : t(focus.nowIsBest ? 'focusHours.bestNow' : 'focusHours.best', {
          hour: formatFocusHour(focus.bestHour, lang),
          rate: focus.bestRate.toFixed(FOCUS_HOURS_RATE_DECIMALS),
        });

  return (
    <>
      {hint && (
        <p className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-3 py-2 text-sm text-violet-200">
          {hint.kind === 'now'
            ? t('ui.productiveWindowNow')
            : t('ui.bestWindowLeftToday', { start: utcHourToLocalLabel(hint.startHour, now), end: utcHourToLocalLabel(hint.endHour, now) })}
        </p>
      )}
      {focusLine && (
        <p className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-3 py-2 text-sm text-violet-200">
          {focusLine}
        </p>
      )}
    </>
  );
}
