import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getNotebookEntry } from '../api/notebookService';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';
import { clearPendingNotebookEntry } from '../lib/pendingNotebookEntry';
import { rememberSharePanelOpen } from './useEntryShare';
import type { NotebookEntry } from '../types/models';

// Abre a nota pedida no URL (?entry=<id>).
export function useNotebookEntryLink(onOpen: (entry: NotebookEntry) => void): void {
  const { t } = useI18n();
  const { notify } = useFeedback();

  // Sobra de versoes antigas: o Command Palette deixava a entrada em
  // sessionStorage. Agora usa ?entry=<id>; limpa um snapshot que tenha
  // ficado para nunca abrir uma copia velha.
  useEffect(() => {
    clearPendingNotebookEntry();
  }, []);

  // ?entry=<id>(&share=1): vindo do Social, de uma nota partilhada ou de um
  // aviso push. Abre a nota (e o painel de partilha) e limpa o URL, para um
  // F5 depois de mudar de nota nao voltar a esta.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedEntryId = searchParams.get('entry');
  const linkedShare = searchParams.get('share') === '1';
  useEffect(() => {
    if (!linkedEntryId) return undefined;
    if (linkedShare) rememberSharePanelOpen();
    let cancelled = false;
    getNotebookEntry(linkedEntryId)
      .then((entry) => {
        if (cancelled) return;
        onOpen(entry);
      })
      // Nota apagada (ou sem acesso): avisa em vez de ficar tudo calado.
      .catch(() => {
        if (!cancelled) notify(t('ux4notes.notebook.entryNotFound'), 'error');
      })
      .finally(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so reage ao link
  }, [linkedEntryId, linkedShare]);
}
