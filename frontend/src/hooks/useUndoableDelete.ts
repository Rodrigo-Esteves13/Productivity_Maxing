import { useCallback } from 'react';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';

export interface UndoableDeleteOptions<T = unknown> {
  // Mensagem do toast, ja traduzida ("Tarefa apagada").
  message: string;
  // Recria o registo apagado pelo endpoint de criacao habitual, com os mesmos dados.
  restore: () => Promise<T>;
  // Corre depois de restaurar com sucesso (por norma, repor o estado local).
  onRestored?: (restored: T) => void;
}

// Toast com "Anular" depois de apagar. Padrao irmao de useCompleteWithUndo:
// o apagar ja foi feito no servidor e anular recria o registo com os mesmos
// dados (o id muda). Se a recriacao falhar, mostra um erro.
export function useUndoableDelete() {
  const { notify } = useFeedback();
  const { t } = useI18n();

  return useCallback(
    <T>({ message, restore, onRestored }: UndoableDeleteOptions<T>) => {
      notify(message, 'success', {
        label: t('undo.action'),
        onAction: () => {
          restore()
            .then((restored) => onRestored?.(restored))
            .catch(() => notify(t('undo.failed'), 'error'));
        },
      });
    },
    [notify, t],
  );
}
