import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { getAgentConfig, updateAgentConfig } from '../api/agentService';
import type { AgentConfig } from '../types/models';

interface UseAgentConfigReturn {
  config: AgentConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  // O componente vai editando um rascunho local (draft) e só chama save()
  // quando quiser persistir - evita um PUT a cada tecla premida num input
  // de texto (ex: a adicionar um domínio à lista).
  updateDraft: (patch: Partial<AgentConfig>) => void;
  // Devolve true em sucesso, false em falha - o componente usa isto para
  // decidir se mostra "Saved!" (nunca deve mostrar isso numa gravação que
  // falhou, mesmo que saveError também apareça).
  save: () => Promise<boolean>;
}

// class-validator (NestJS) devolve erros de validação em
// { statusCode, message: string[], error }. Mostramos essa mensagem
// diretamente em vez de um genérico "algo correu mal" sempre que
// existir - é o que diz exatamente qual campo falhou e porquê (ex:
// "pollIntervalSeconds must not be greater than 3600").
function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(' ');
    if (typeof data?.message === 'string') return data.message;
  }
  return 'Could not save the configuration. Try again.';
}

// Rede de segurança: mesmo que o input do formulário deixe passar algo
// inválido, nunca enviamos um pollIntervalSeconds fora do intervalo que o
// backend aceita (15-3600s, ver upsert-agent-config.dto.ts) - arredondamos
// e fazemos clamp aqui, em vez de depender só da validação do lado do
// backend para rejeitar.
const MIN_POLL_INTERVAL_SECONDS = 15;
const MAX_POLL_INTERVAL_SECONDS = 3600;
function clampPollInterval(value: number): number {
  if (!Number.isFinite(value)) return MIN_POLL_INTERVAL_SECONDS;
  const rounded = Math.round(value);
  return Math.min(MAX_POLL_INTERVAL_SECONDS, Math.max(MIN_POLL_INTERVAL_SECONDS, rounded));
}

export function useAgentConfig(): UseAgentConfigReturn {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await getAgentConfig();
        setConfig(data);
      } catch (error: unknown) {
        console.error('Failed to load agent config:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updateDraft = useCallback((patch: Partial<AgentConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsSaving(true);
    setSaveError(null);
    try {
      const { isConfigured: _ignored, ...payload } = config;
      void _ignored;
      payload.pollIntervalSeconds = clampPollInterval(payload.pollIntervalSeconds);
      const saved = await updateAgentConfig(payload);
      setConfig(saved);
      return true;
    } catch (error: unknown) {
      console.error('Failed to save agent config:', error);
      setSaveError(extractErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  return { config, isLoading, isSaving, saveError, updateDraft, save };
}
