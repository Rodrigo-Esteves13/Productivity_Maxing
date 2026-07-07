import type { ReactNode } from 'react';

interface LegalSectionProps {
  number: number;
  title: string;
  children: ReactNode;
}

export default function LegalSection({ number, title, children }: LegalSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-2">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}