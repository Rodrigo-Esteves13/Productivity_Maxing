import { Link } from 'react-router-dom';
import { useI18n } from '../../../i18n/useI18n';

// Atalho para o caderno da cadeira da sessao. O Notebook le ?area= ao abrir.
export default function OpenNotesLink({ areaId }: { areaId: string | null | undefined }) {
  const { t } = useI18n();
  if (!areaId) return null;
  return (
    <Link
      to={`/notebook?area=${encodeURIComponent(areaId)}`}
      className="text-xs text-violet-400 underline decoration-dotted hover:text-violet-300"
    >
      {t('ui.openNotesForThisSubject')}
    </Link>
  );
}
