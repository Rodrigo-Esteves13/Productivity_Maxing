import { useEffect, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { updateStudySession } from '../../../api/studySessionsService';
import { useI18n } from '../../../i18n/useI18n';
import { MS_PER_SECOND } from '../../../lib/timeConstants';
import RatingInput from '../../UI/RatingInput';
import Button from '../../UI/Button';

// Quanto tempo o aviso fica ate desaparecer sozinho se ignorares.
const PROMPT_TIMEOUT_MS = 90 * MS_PER_SECOND;
// Quanto tempo o "guardado" fica visivel antes de fechar.
const SAVED_FLASH_MS = 1.2 * MS_PER_SECOND;

// "Como foi o foco?" logo a seguir a qualquer sessao que acabou sem foco
// classificado (fim de bloco, inatividade, botao de parar). Um toque. E
// este dado que alimenta o cartao "Focus and your grades" do Dashboard.
export default function RateFocusPrompt() {
  const { t } = useI18n();
  const { justStopped, dismissJustStopped } = useActiveStudySession();
  const [isSaved, setIsSaved] = useState(false);
  const [hasError, setHasError] = useState(false);
  const sessionId = justStopped?.id ?? null;

  useEffect(() => {
    if (!sessionId) return;
    setIsSaved(false);
    setHasError(false);
    const timer = window.setTimeout(dismissJustStopped, PROMPT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [sessionId, dismissJustStopped]);

  if (!justStopped) return null;

  const save = async (rating: number | null) => {
    if (rating === null) return;
    setHasError(false);
    try {
      await updateStudySession(justStopped.id, { focusRating: rating });
      setIsSaved(true);
      window.setTimeout(dismissJustStopped, SAVED_FLASH_MS);
    } catch {
      setHasError(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={t('rateFocus.title')}
      className="rounded-xl border border-violet-600/60 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm"
    >
      <p className="text-sm font-medium text-white">{isSaved ? t('rateFocus.saved') : t('rateFocus.title')}</p>
      {!isSaved && (
        <>
          <div className="mt-2">
            <RatingInput value={null} onChange={(value) => void save(value)} hint={t('rateFocus.hint')} />
          </div>
          {hasError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {t('rateFocus.error')}
            </p>
          )}
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={dismissJustStopped}>
              {t('rateFocus.skip')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
