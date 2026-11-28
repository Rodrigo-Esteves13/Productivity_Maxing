import { useRef, useState, type FormEvent } from 'react';
import { appendFocusThought } from '../../../api/personalNotesService';
import { THOUGHT_MAX_LENGTH } from '../../../lib/focusThoughts';
import { getHttpStatus, HTTP_BAD_REQUEST } from '../../../lib/httpError';
import { recordDistraction } from '../../../api/studySessionsService';
import { useI18n } from '../../../i18n/useI18n';
import { useActiveStudySession } from '../../../context/useActiveStudySession';

// Mensagem de cada estado do pensamento (idle nao diz nada).
const THOUGHT_STATE_KEY: Record<string, string | undefined> = {
  saved: 'focus.distractions.thoughtSaved',
  trimmed: 'focus.distractions.thoughtTrimmed',
  full: 'focus.distractions.thoughtFull',
  failed: 'focus.distractions.thoughtError',
};

interface Props {
  sessionId: string;
  initialCount: number;
}

// "Got distracted": em vez de seguir a distracao, regista-a com um clique e
// volta ao trabalho. Notar a distracao ja ajuda a resistir-lhe; o total fica
// na sessao para veres quando te distrais mais. Remontado por sessao (key).
export default function DistractionButton({ sessionId, initialCount }: Props) {
  const { t, lang } = useI18n();
  const [thought, setThought] = useState('');
  const [showThought, setShowThought] = useState(false);
  const [thoughtState, setThoughtState] = useState<'idle' | 'saved' | 'trimmed' | 'full' | 'failed'>('idle');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const savingThought = useRef(false);
  const [count, setCount] = useState(initialCount);
  const [justNoted, setJustNoted] = useState(false);
  const [failed, setFailed] = useState(false);
  const { setDistractionCount } = useActiveStudySession();

  const note = async () => {
    // Otimista: o clique tem de parecer instantaneo.
    setCount((c) => c + 1);
    setJustNoted(true);
    setFailed(false);
    setShowThought(true);
    setThoughtState('idle');
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

  // Guarda o pensamento na nota "Durante o foco" (uma linha por pensamento).
  const saveThought = async (event: FormEvent) => {
    event.preventDefault();
    if (!thought.trim() || savingThought.current) return;
    savingThought.current = true;
    const stamp = new Date().toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    try {
      const dropped = await appendFocusThought(t('focus.distractions.noteTitle'), thought, stamp);
      setThought('');
      setShowThought(false);
      setThoughtState(dropped > 0 ? 'trimmed' : 'saved');
      // O formulario desaparece: o foco volta ao botao em vez de se perder.
      buttonRef.current?.focus();
    } catch (error) {
      setThoughtState(getHttpStatus(error) === HTTP_BAD_REQUEST ? 'full' : 'failed');
    } finally {
      savingThought.current = false;
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => void note()}
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
      >
        {t('focus.distractions.button')}
        {count > 0 && <span className="ml-1.5 font-semibold tabular-nums text-neutral-100">{count}</span>}
      </button>
      <p role="status" className="min-h-4 text-[11px] text-neutral-500">
        {failed
          ? t('focus.distractions.error')
          : THOUGHT_STATE_KEY[thoughtState]
            ? t(THOUGHT_STATE_KEY[thoughtState] as string)
            : justNoted
              ? t('focus.distractions.noted')
              : ''}
      </p>
      {showThought && (
        <form onSubmit={(e) => void saveThought(e)} className="flex w-full max-w-xs items-center gap-2">
          <input
            value={thought}
            maxLength={THOUGHT_MAX_LENGTH}
            onChange={(e) => setThought(e.target.value)}
            aria-label={t('focus.distractions.thoughtLabel')}
            placeholder={t('focus.distractions.thoughtPlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-base text-white focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 sm:text-xs"
          />
          <button
            type="submit"
            disabled={!thought.trim()}
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-md px-2 py-1 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50"
          >
            {t('focus.distractions.thoughtSave')}
          </button>
        </form>
      )}
    </div>
  );
}
