import { useLayoutEffect, useRef } from 'react';

interface NotebookTableCellProps {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

// Celula de tabela que cresce com o texto (quebra de linha) em vez de
// cortar numa linha unica como um <input>. Altura recalculada a cada
// mudanca de valor.
export default function NotebookTableCell({ value, readOnly, onChange }: NotebookTableCellProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full min-w-[9rem] resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent px-2 py-1.5 text-neutral-100 leading-snug focus:bg-neutral-800 focus:outline-none"
    />
  );
}
