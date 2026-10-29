import type { ReactNode } from 'react';
import { legalSectionId } from './legalAnchors';

interface LegalSectionProps {
  number: number;
  title: string;
  children: ReactNode;
}

export default function LegalSection({ number, title, children }: LegalSectionProps) {
  return (
    <section id={legalSectionId(number)} tabIndex={-1} className="mb-8 scroll-mt-24 outline-none">
      <h2 className="text-xl font-semibold mb-2">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}
