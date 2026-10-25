// O Command Palette passava a entrada escolhida ao Notebook por
// sessionStorage, lida so no mount: ja em /notebook nada acontecia e o
// snapshot ficava para abrir mais tarde, velho. Agora navega para
// ?entry=<id> (notebookEntryPath). Isto so limpa o que um separador com a
// versao antiga possa ter deixado.
const KEY = 'pmaxing:pending-notebook-entry';

export function clearPendingNotebookEntry(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // sem sessionStorage: nada a limpar
  }
}
