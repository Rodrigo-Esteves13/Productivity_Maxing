import type { ReactNode } from 'react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-neutral-200">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: {lastUpdated}</p>
      {children}
    </div>
  );
}