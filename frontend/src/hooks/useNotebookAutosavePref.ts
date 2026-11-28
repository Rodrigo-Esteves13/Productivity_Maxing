import { ON_BY_DEFAULT, usePersistedState } from './usePersistedState';

const STORAGE_KEY = 'pm-notebook-autosave';
// Preferencia local (por dispositivo) do auto save do Notebook. Por omissao
// ligado: ninguem que nunca mexeu no toggle perde o auto save. Todas as
// entradas abertas (e outras tabs) veem a mesma escolha ao mesmo tempo.
export function useNotebookAutosavePref() {
  const [autosaveEnabled, setAutosaveEnabled] = usePersistedState(STORAGE_KEY, ON_BY_DEFAULT);
  return { autosaveEnabled, setAutosaveEnabled };
}
