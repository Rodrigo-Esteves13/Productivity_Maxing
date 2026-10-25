import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { usePackUpdates } from '../../hooks/usePackUpdates';

// Aviso na pagina de tasks quando alguem atualizou um pacote que importaste.
// So aparece com pedidos por responder; a revisao vive em /task-packs.
export default function PackUpdatesBanner() {
  const { t } = useI18n();
  const { updates } = usePackUpdates();
  if (updates.length === 0) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-800 bg-violet-950/40 p-3 text-sm text-violet-200"
    >
      <span>{updates.length === 1 ? t('packs.updates.bannerOne') : t('packs.updates.banner', { count: updates.length })}</span>
      <Link to="/task-packs#updates" className="font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200">
        {t('packs.updates.review')}
      </Link>
    </div>
  );
}
