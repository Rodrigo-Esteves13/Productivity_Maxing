import Button from '../UI/Button';
import { useI18n } from '../../i18n/useI18n';

interface VersionConflictBannerProps {
  onTakeRemote: () => void;
  onKeepMine: () => void;
}

// Alguem gravou enquanto este utilizador escrevia: ficar com a versao dos
// outros (perde o que escreveu desde a ultima gravacao) ou gravar por cima.
export default function VersionConflictBanner({ onTakeRemote, onKeepMine }: VersionConflictBannerProps) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mb-3 rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
      <p className="mb-2">{t('collab.conflict.message')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onTakeRemote}>
          {t('collab.conflict.takeRemote')}
        </Button>
        <Button className="px-3 py-1.5 text-xs" onClick={onKeepMine}>
          {t('collab.conflict.keepMine')}
        </Button>
      </div>
    </div>
  );
}
