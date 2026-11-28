import { useState, type SyntheticEvent } from 'react';

// Marca um formulario como alterado a partir de qualquer input/select/textarea
// dentro do wrapper (os eventos sobem). Volta a limpo quando o modal fecha.
// Uso: <Modal isDirty={dirty.isDirty}><div onInput={dirty.markDirty}>...</div></Modal>
export function useDirtyForm(isOpen: boolean) {
  const [isDirty, setIsDirty] = useState(false);
  if (!isOpen && isDirty) setIsDirty(false);

  return {
    isDirty,
    markDirty: (e?: SyntheticEvent) => {
      // Ignora o "input" de botoes sem valor (ex.: submit); so campos editaveis.
      const target = e?.target;
      if (target instanceof HTMLButtonElement) return;
      setIsDirty(true);
    },
  };
}
