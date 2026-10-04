import type { ReactNode } from 'react';
import { XIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';

interface EntryListRowProps {
  icon: ReactNode;
  // Mostrado depois do conteudo, sem ser clicavel (ex: tamanho do ficheiro).
  trailing?: ReactNode;
  // Presente so em edicao: mostra o botao de remover com este nome.
  removeLabel?: string;
  onRemove?: () => void;
  children: ReactNode;
}

// Linha de lista de uma entrada (link util, anexo): icone, conteudo e,
// em edicao, botao de remover. Links e anexos tinham a mesma linha copiada.
export default function EntryListRow({ icon, trailing, removeLabel, onRemove, children }: EntryListRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5">
      <span className="shrink-0 text-neutral-500">{icon}</span>
      {children}
      {trailing}
      {onRemove && removeLabel && (
        <IconButton label={removeLabel} className="ml-auto shrink-0 hover:bg-neutral-800" onClick={onRemove}>
          <XIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  );
}
