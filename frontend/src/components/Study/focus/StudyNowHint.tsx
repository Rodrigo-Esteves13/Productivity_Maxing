import { useBestTimesHeatmap } from '../../../hooks/useBestTimesHeatmap';
import { suggestStudyWindow } from '../../../lib/studyWindow';

// O heatmap vem em horas do servidor (UTC); mostra-se na hora local de quem le.
function utcHourToLocalLabel(utcHour: number, now: Date): string {
  const moment = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour));
  return moment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Uma linha que diz se esta e uma das tuas boas horas. So aparece com
// sessoes que cheguem (ver MIN_SESSIONS_FOR_HINT): antes disso nao ha padrao.
export default function StudyNowHint() {
  const { cells } = useBestTimesHeatmap();
  const now = new Date();
  const hint = suggestStudyWindow(cells, now);
  if (!hint) return null;

  return (
    <p className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-3 py-2 text-sm text-violet-200">
      {hint.kind === 'now'
        ? 'This is one of your most productive windows. A good time to start.'
        : `Your best window left today is ${utcHourToLocalLabel(hint.startHour, now)} to ${utcHourToLocalLabel(hint.endHour, now)}.`}
    </p>
  );
}
