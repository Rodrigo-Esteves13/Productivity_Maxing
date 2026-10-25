import { useCallback, useEffect, useState } from 'react';
import { getApiKeys, createApiKey, revokeApiKey } from '../api/userService';
import type { ApiKeySummary, ApiKeyScope } from '../types/models';

interface UseApiKeysReturn {
  keys: ApiKeySummary[];
  isLoading: boolean;
  // Falha a carregar a lista (E-11): sem isto aparecia "não tens keys".
  loadError: boolean;
  isCreating: boolean;
  // Falha a criar (ex: 429 com 5/min); limpo na tentativa seguinte.
  createError: boolean;
  // Só fica preenchido logo a seguir a criar uma key - é a única vez em
  // que o valor em texto simples existe algures. Limpar isto (clearNewKey)
  // depois de o user fechar o aviso é intencional, não dá para voltar a
  // mostrar a mesma key outra vez.
  newlyCreatedKey: string | null;
  createKey: (name: string, scope?: ApiKeyScope) => Promise<boolean>;
  removeKey: (id: string) => Promise<void>;
  clearNewKey: () => void;
}

export function useApiKeys(): UseApiKeysReturn {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApiKeys();
      setKeys(data);
      setLoadError(false);
    } catch (error: unknown) {
      console.error('Failed to load API keys:', error);
      setLoadError(true);
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
      setCreateError(false);
      try {
        const { apiKey } = await createApiKey(name, scope);
        setNewlyCreatedKey(apiKey);
        await refresh();
        return true;
      } catch (error: unknown) {
        console.error('Failed to create API key:', error);
        setCreateError(true);
        return false;
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

  return {
    keys,
    isLoading,
    loadError,
    isCreating,
    createError,
    newlyCreatedKey,
    createKey,
    removeKey,
    clearNewKey,
  };
}
