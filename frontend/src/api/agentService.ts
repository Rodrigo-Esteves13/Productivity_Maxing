import api from './client';
import type { AgentConfig } from '../types/models';

// AGENT CONFIG (página /agent)
// Mesmos endpoints que o pmaxing-agent local usa para ir buscar as regras
// a cada ciclo de polling, autenticado com x-api-key - aqui usamos a
// sessão JWT normal, mas é o mesmo JwtOrApiKeyAuthGuard do lado do
// backend.
export const getAgentConfig = async (): Promise<AgentConfig> => {
  const response = await api.get<AgentConfig>('/agent/config');
  return response.data;
};

// PUT em vez de PATCH: a página envia sempre o objeto completo (o
// formulário controla todos os campos), por isso um replace total é mais
// simples de raciocinar do que um merge parcial.
export const updateAgentConfig = async (
  config: Omit<AgentConfig, 'isConfigured'>,
): Promise<AgentConfig> => {
  const response = await api.put<AgentConfig>('/agent/config', config);
  return response.data;
};
