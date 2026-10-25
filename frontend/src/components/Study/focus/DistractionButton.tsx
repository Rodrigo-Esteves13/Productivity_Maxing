import { useState } from 'react';
import { recordDistraction } from '../../../api/studySessionsService';
import { useI18n } from '../../../i18n/useI18n';
import { useActiveStudySession } from '../../../context/useActiveStudySession';

interface Props {
  sessionId: string;
  initialCount: number;
}

// "Got distracted": em vez de seguir a distracao, regista-a com um clique e
// volta ao trabalho. Notar a distracao ja ajuda a resistir-lhe; o total fica
// na sessao para veres quando te distrais mais. Remontado por sessao (key).
export default function DistractionButton({ sessionId, initialCount }: Props) {
  const { t } = useI18n();
  const [count, setCount] = useState(initialCount);
  const [justNoted, setJustNoted] = useState(false);
  const [failed, setFailed] = useState(false);
  const { setDistractionCount } = useActiveStudySession();

  const note = async () => {
    // Otimista: o clique tem de parecer instantaneo.
    setCount((c) => c + 1);
    setJustNoted(true);
    setFailed(false);
    try {
      const saved = await recordDistraction(sessionId);
      // Cliques rapidos: uma resposta antiga nao pode baixar o contador.
      setCount((c) => Math.max(c, saved));
      setDistractionCount(saved);
    } catch {
      setCount((c) => Math.max(0, c - 1));
      setFailed(true);
      setJustNoted(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void note()}
        className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
      >
        {t('focus.distractions.button')}
        {count > 0 && <span className="ml-1.5 font-semibold tabular-nums text-neutral-100">{count}</span>}
      </button>
      <p role="status" className="min-h-4 text-[11px] text-neutral-500">
        {failed ? t('focus.distractions.error') : justNoted ? t('focus.distractions.noted') : ''}
      </p>
    </div>
  );
}
