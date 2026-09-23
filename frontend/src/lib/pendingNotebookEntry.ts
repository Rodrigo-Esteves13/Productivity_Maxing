import type { NotebookSearchResult } from '../types/models';

// Usado só para passar "abre esta entrada" do CommandPalette (global, fora
// da página Notebook) para a página Notebook depois do navigate() - não é
// nada sensível (é a mesma entrada que o /notebook/search já devolveu ao
// utilizador autenticado), ao contrário do csrfToken em csrfStore.ts, que
// nunca pode ir para sessionStorage/localStorage.
const KEY = 'pmaxing:pending-notebook-entry';

export function setPendingNotebookEntry(entry: NotebookSearchResult): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Sem sessionStorage disponível (modo privado restrito, etc.) - a
    // pior consequência é o Notebook abrir na Area errada, nada crítico.
  }
}

// Consome (lê + apaga) o valor pendente - só deve ser aplicado uma vez,
// no primeiro render da página Notebook depois do navigate().
export function consumePendingNotebookEntry(): NotebookSearchResult | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as NotebookSearchResult;
  } catch {
    return null;
  }
}
