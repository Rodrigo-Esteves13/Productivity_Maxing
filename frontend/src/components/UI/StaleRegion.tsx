import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface StaleRegionProps {
  // O conteudo e do periodo anterior e o novo ainda esta a chegar.
  isStale: boolean;
  children: ReactNode;
}

// Mantem o conteudo antigo no ecra enquanto o novo carrega, sem esqueleto.
// `inert` impede qualquer clique ou tecla sobre dados que ja nao sao os
// escolhidos. O atraso da opacidade evita um piscar quando a resposta e quase
// imediata (cache).
export default function StaleRegion({ isStale, children }: StaleRegionProps) {
  const { t } = useI18n();
  return (
    <div aria-busy={isStale}>
      <div role="status" className="pointer-events-none sticky top-20 z-30 h-0">
        {isStale && (
          <div className="flex justify-center">
            <span className="motion-page rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200 shadow-lg">
              {t('common.loading')}
            </span>
          </div>
        )}
      </div>
      <div
        inert={isStale}
        className={`transition-opacity duration-[var(--duration-quick)] ease-smooth-out ${isStale ? 'opacity-50 delay-150' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
