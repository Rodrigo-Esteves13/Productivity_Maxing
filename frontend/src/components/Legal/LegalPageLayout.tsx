import { Children, isValidElement, type ReactNode } from 'react';
import OnThisPage from '../Layout/OnThisPage';
import LegalSection from './LegalSection';
import { legalSectionId } from './legalAnchors';
import { useI18n } from '../../i18n/useI18n';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

interface LegalSectionProps {
  number: number;
  title: string;
}

// O indice sai das proprias secoes (LegalSection), por isso nao ha uma
// segunda lista para manter. No ecra largo fica fixo ao lado, com a secao
// atual marcada; no telemovel e uma lista que se abre no topo.
export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  const { t } = useI18n();
  const sections = Children.toArray(children)
    .filter((child) => isValidElement<LegalSectionProps>(child) && child.type === LegalSection)
    .map((child) => {
      const { number, title: sectionTitle } = (child as { props: LegalSectionProps }).props;
      return { id: legalSectionId(number), label: `${number}. ${sectionTitle}` };
    });

  const hasIndex = sections.length > 1;

  return (
    <div
      className={`mx-auto max-w-3xl px-6 py-12 text-neutral-200 ${
        hasIndex ? 'lg:grid lg:max-w-6xl lg:grid-cols-[14rem_minmax(0,48rem)] lg:justify-center lg:gap-12' : ''
      }`}
    >
      {hasIndex && (
        <aside className="print-hide hidden lg:block">
          <OnThisPage layout="column" items={sections} className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto" />
        </aside>
      )}
      <div className="min-w-0">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 mb-8">{t('ui.lastUpdated2', { lastUpdated: lastUpdated })}</p>
        {hasIndex && (
          <details className="print-hide mb-8 rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium text-neutral-300">{t('map.contents')}</summary>
            <OnThisPage layout="column" items={sections} className="mt-3 [&>p]:hidden" />
          </details>
        )}
        {children}
      </div>
    </div>
  );
}
