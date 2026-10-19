import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-neutral-200">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-neutral-500 mb-8">{t('ui.lastUpdated2', { lastUpdated: lastUpdated })}</p>
      {children}
    </div>
  );
}