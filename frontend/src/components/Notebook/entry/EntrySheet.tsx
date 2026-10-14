import type { ReactNode } from 'react';

interface EntrySheetProps {
  toolbar: ReactNode;
  children: ReactNode;
}

// A "folha" do caderno: a unica peca com personalidade da pagina. Margem
// vertical em violeta (como a linha de margem de um caderno) e conteudo a
// respirar a direita dela. O resto da UI fica discreto.
export default function EntrySheet({ toolbar, children }: EntrySheetProps) {
  return (
    <article className="relative rounded-xl border border-neutral-800 bg-neutral-900/50">
      {toolbar}
      <div className="relative px-4 pb-10 pt-6 sm:pl-16 sm:pr-8">
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-0 hidden w-px bg-violet-500/25 sm:left-12 sm:block"
        />
        <div className="space-y-8">{children}</div>
      </div>
    </article>
  );
}
