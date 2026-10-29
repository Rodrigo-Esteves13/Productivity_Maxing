import { useLocation, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../UI/Breadcrumbs';
import RelatedLinks from './RelatedLinks';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { pageChain, sitePage } from '../../lib/siteMap';

// Topo de cada pagina principal: o trilho (secao com as irmas / pai /
// pagina) e, ao lado, com que paginas trabalha. Tudo vem do mapa, por isso
// nenhuma pagina tem de se lembrar de o por. As sub-paginas (uma turma, o
// perfil de um amigo) tem o seu proprio Breadcrumbs.
export default function PageTrail() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const page = sitePage(pathname);
  if (!page) return null;

  const chain = pageChain(page);
  const tab = params.get('tab');
  const tabKey = tab ? page.tabs?.[tab] : undefined;
  const items = chain.map((p, index) => ({
    label: t(p.labelKey),
    // A propria pagina so e link quando ha um separador a seguir.
    to: index < chain.length - 1 || tabKey ? p.path : undefined,
  }));
  if (tabKey) items.push({ label: t(tabKey), to: undefined });
  return (
    <div className="print-hide mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <Breadcrumbs
        className=""
        section={page.section}
        items={items}
      />
      {/* Sem sessao (paginas legais, Pads) os links so levavam ao login. */}
      {isAuthenticated && page.related && page.related.length > 0 && (
        <RelatedLinks links={page.related} className="" />
      )}
    </div>
  );
}
