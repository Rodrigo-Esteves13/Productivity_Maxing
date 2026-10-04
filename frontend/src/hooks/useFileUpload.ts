import { useState } from 'react';
import type { ChangeEvent } from 'react';

interface UseFileUploadParams {
  // Devolve a mensagem de erro, ou null se o ficheiro e aceitavel.
  validate: (file: File) => string | null;
  onUpload: (file: File) => Promise<void>;
  failureMessage: string;
}

// Escolha de ficheiro num <input type="file">: limpa o input (para poder
// escolher o mesmo ficheiro outra vez), valida, envia e guarda o erro.
// Fotos e anexos do Notebook faziam exatamente isto, cada um a sua maneira.
export function useFileUpload({ validate, onUpload, failureMessage }: UseFileUploadParams) {
  const [error, setError] = useState('');

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    try {
      await onUpload(file);
    } catch {
      setError(failureMessage);
    }
  };

  return { error, handleChange };
}
