import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

export interface RelatedLink {
  to: string;
  /** Texto curto do que se faz la (chave i18n). */
  labelKey: string;
}

// Faixa "Funciona com" no topo das paginas que se ligam entre si
// (Schedule, Notebook, Turmas, Social): diz o que da para fazer na outra
// pagina em vez de so o nome dela, para as ligacoes serem descobertas.
export default function RelatedLinks({ links }: { links: RelatedLink[] }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('related.label')} className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">{t('related.label')}</span>
      {links.map((link) => (
        <Link
          key={link.to + link.labelKey}
          to={link.to}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-neutral-300 transition-colors hover:border-violet-500/60 hover:text-white"
        >
          {t(link.labelKey)}
          <ArrowRightIcon className="h-3.5 w-3.5 text-neutral-500" />
        </Link>
      ))}
    </nav>
  );
}
