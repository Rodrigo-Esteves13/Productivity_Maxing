import { useEffect } from 'react';
import { XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { useDailyDigest } from '../../hooks/useDailyDigest';

interface DailyDigestCardProps {
  now: Date;
  onShown: () => void;
  onDismiss: () => void;
}

// Cartao pequeno no topo do Dashboard: 1 a 3 linhas do dia. Sem nada a dizer
// nao desenha nada nem gasta a vaga do dia (onShown so corre com linhas).
export default function DailyDigestCard({ now, onShown, onDismiss }: DailyDigestCardProps) {
  const { t } = useI18n();
  const lines = useDailyDigest(now);
  const hasLines = Boolean(lines);

  useEffect(() => {
    if (hasLines) onShown();
  }, [hasLines, onShown]);

  if (!lines) return null;

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 sm:right-auto sm:w-full sm:max-w-sm">
      <div
        role="status"
        className="motion-toast flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-4 pr-1 shadow-lg"
      >
        <div className="min-w-0 flex-1 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            {t('dailyDigest.title')}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-neutral-200">
            {lines.map((line) => (
              <li key={line.key} className="tabular-nums">
                {t(line.key, line.params)}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('dailyDigest.dismiss')}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white active:scale-[0.96]"
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
