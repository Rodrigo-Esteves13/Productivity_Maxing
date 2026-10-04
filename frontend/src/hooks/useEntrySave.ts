import { useState } from 'react';
import type { NotebookEntrySavePayload } from '../components/Notebook/entry/entryTypes';
import { describeSaveError } from '../components/Notebook/entry/notebookEntryConfig';
import { getHttpStatus } from '../lib/httpError';

// Gravar uma entrada: estado "a gravar" + mensagem de erro legivel.
export function useEntrySave(
  onSave: (payload: NotebookEntrySavePayload) => Promise<void>,
  textLength: number,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = async (payload: NotebookEntrySavePayload) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await onSave(payload);
    } catch (err) {
      setSaveError(describeSaveError(getHttpStatus(err), textLength));
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, saveError, save };
}
