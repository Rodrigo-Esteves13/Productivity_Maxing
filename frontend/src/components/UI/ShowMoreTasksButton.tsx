import { useI18n } from '../../i18n/useI18n';

interface ShowMoreTasksButtonProps {
  remaining: number;
  onClick: () => void;
}

// Rodape das listas reveladas por blocos (ver useRevealedTasks).
export default function ShowMoreTasksButton({ remaining, onClick }: ShowMoreTasksButtonProps) {
  const { t } = useI18n();
  if (remaining <= 0) return null;
  return (
    <div className="print-hide flex justify-center py-2">
      <button
        type="button"
        onClick={onClick}
        className="text-sm text-violet-400 hover:text-violet-300 pointer-coarse:min-h-11"
      >
        {t('ui.showMoreTasksLeft', { remaining })}
      </button>
    </div>
  );
}
