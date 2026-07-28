import { useCallback, useEffect, useState } from 'react';
import { getApiKeys, createApiKey, revokeApiKey } from '../api/userService';
import type { ApiKeySummary, ApiKeyScope } from '../types/models';

interface UseApiKeysReturn {
  keys: ApiKeySummary[];
  isLoading: boolean;
  isCreating: boolean;
  // Só fica preenchido logo a seguir a criar uma key - é a única vez em
  // que o valor em texto simples existe algures. Limpar isto (clearNewKey)
  // depois de o user fechar o aviso é intencional, não dá para voltar a
  // mostrar a mesma key outra vez.
  newlyCreatedKey: string | null;
  createKey: (name: string, scope?: ApiKeyScope) => Promise<void>;
  removeKey: (id: string) => Promise<void>;
  clearNewKey: () => void;
}

export function useApiKeys(): UseApiKeysReturn {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch (error: unknown) {
      console.error('Failed to load API keys:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createKey = useCallback(
    async (name: string, scope: ApiKeyScope = 'TASKS') => {
      setIsCreating(true);
      try {
        const { apiKey } = await createApiKey(name, scope);
        setNewlyCreatedKey(apiKey);
        await refresh();
      } finally {
        setIsCreating(false);
      }
    },
    [refresh],
  );

  const removeKey = useCallback(async (id: string) => {
    // Otimista: tira já da lista, sem esperar pela resposta - revogar é
    // destrutivo e imediato, não há motivo para o user ver a key "morta"
    // na lista por mais um segundo.
    setKeys((prev) => prev.filter((k) => k.id !== id));
    try {
      await revokeApiKey(id);
    } catch (error: unknown) {
      console.error('Failed to revoke API key:', error);
      // Falhou de verdade - repõe a lista real do servidor.
      await refresh();
    }
  }, [refresh]);

  const clearNewKey = useCallback(() => setNewlyCreatedKey(null), []);

  return { keys, isLoading, isCreating, newlyCreatedKey, createKey, removeKey, clearNewKey };
}
