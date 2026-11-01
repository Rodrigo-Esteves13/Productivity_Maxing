import Button from './Button';
import { useI18n } from '../../i18n/useI18n';

interface ErrorStateProps {
  message: string;
  // Quando existe, mostra um botao "Try again" que volta a pedir os dados.
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={`p-4 bg-red-950/40 border border-red-900/50 rounded-lg text-red-300 ${
        onRetry ? 'flex flex-wrap items-center justify-between gap-3' : ''
      }`}
    >
      <span>{message}</span>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
