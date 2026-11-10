import { useState } from 'react';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import {
  createStreakFreeze,
  deleteStreakFreeze,
  getStreakFreezeStatus,
} from '../../api/streakFreezesService';
import { useI18n } from '../../i18n/useI18n';
import { restDaysLeft, restDayView } from '../../lib/streakRestDay';

interface StreakRestDayButtonProps {
  // Muda quando a streak e recarregada (ex: sessao ativa), para reavaliar.
  refreshKey?: string | null;
  // Chamado depois de pedir/desfazer o descanso, para recarregar a streak.
  onChange?: () => void;
}

// "Usar um dia de descanso" para hoje: o dia faz ponte na streak de estudo
// (nao a aumenta nem a parte). Escondido quando nao da para usar (ja ha
// sessao hoje, sem vaga esta semana); com descanso ativo mostra o estado e
// deixa desfazer.
export default function StreakRestDayButton({ refreshKey, onChange }: StreakRestDayButtonProps) {
  const { t } = useI18n();
  const { data: status, reload } = useLoadOnce(getStreakFreezeStatus, refreshKey);
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const view = restDayView(status);
  if (!status || view === 'hidden') return null;

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    setFailed(false);
    try {
      await action();
      onChange?.();
    } catch {
      setFailed(true);
    } finally {
      reload();
      setIsBusy(false);
    }
  };

  const todayFreezeId = status.todayFreezeId;
  if (view === 'active' && todayFreezeId) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300" title={t('streakFreeze.claim.activeHint')}>
          {t('streakFreeze.claim.active')}
        </span>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(() => deleteStreakFreeze(todayFreezeId))}
          className="text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline disabled:opacity-50"
        >
          {t('streakFreeze.claim.undo')}
        </button>
        {failed && <span className="text-red-400">{t('streakFreeze.claim.error')}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => run(() => createStreakFreeze())}
        title={t('streakFreeze.claim.hint', { max: status.maxPerWeek })}
        className="rounded-md border border-neutral-700 px-2 py-0.5 text-neutral-300 transition-colors hover:border-sky-500/60 hover:text-sky-300 disabled:opacity-50"
      >
        {t('streakFreeze.claim.button')}
      </button>
      <span className="text-neutral-500">
        {t('streakFreeze.claim.left', { count: restDaysLeft(status) })}
      </span>
      {failed && <span className="text-red-400">{t('streakFreeze.claim.error')}</span>}
    </div>
  );
}
