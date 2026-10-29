import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { prefersReducedMotion } from '../../lib/completionFeedback';

export interface PageSectionLink {
  /** id do elemento na pagina (com tabIndex={-1} para receber o foco). */
  id: string;
  label: string;
}

// A navbar e sticky: sem esta margem o titulo ficava escondido por baixo.
const SECTION_ANCHOR_CLASS = 'scroll-mt-24 outline-none';

/** Embrulha uma parte da pagina para o indice poder saltar para ela. */
export function SectionAnchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} tabIndex={-1} className={SECTION_ANCHOR_CLASS}>
      {children}
    </div>
  );
}

// Qual das secoes esta no topo do ecra, para a marcar no indice.
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const elements = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return undefined;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // A primeira (pela ordem da pagina) das que estao na faixa de cima.
        const first = elements.find((element) => visible.has(element.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-96px 0px -55% 0px' },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  return active;
}

function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  // O foco vai junto, para quem usa teclado continuar a partir dali.
  target.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, '', `#${id}`);
}

// "Nesta pagina": o mapa dentro de uma pagina longa (definicoes do perfil,
// paginas legais), para saltar para uma parte sem fazer scroll as cegas.
// 'row' e uma faixa de chips (desliza no telemovel, como os "Works with");
// 'column' e uma lista para a lateral, com a secao atual marcada.
export default function OnThisPage({
  items,
  layout = 'row',
  className = '',
}: {
  items: PageSectionLink[];
  layout?: 'row' | 'column';
  className?: string;
}) {
  const { t } = useI18n();
  const active = useActiveSection(items.map((item) => item.id));

  // Abrir com #secao no endereco (link partilhado) leva logo la.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  if (layout === 'column') {
    return (
      <nav aria-label={t('map.onThisPage')} className={className}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{t('map.onThisPage')}</p>
        <ol className="space-y-0.5 border-l border-neutral-800 text-sm">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(event) => jumpTo(event, item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`-ml-px block border-l py-1 pl-3 transition-colors hover:text-white ${
                    isActive ? 'border-violet-400 text-white' : 'border-transparent text-neutral-400'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t('map.onThisPage')}
      className={`-mx-4 flex min-w-0 max-w-full items-center gap-2 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}
    >
      <span className="shrink-0 text-neutral-500">{t('map.onThisPage')}</span>
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => jumpTo(event, item.id)}
            aria-current={isActive ? 'location' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 transition-colors hover:border-violet-500/60 hover:text-white ${
              isActive ? 'border-violet-500/60 bg-violet-500/10 text-white' : 'border-neutral-800 bg-neutral-900 text-neutral-300'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
