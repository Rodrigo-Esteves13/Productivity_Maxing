import axios from 'axios';

/**
 * True quando o erro e so um pedido cancelado de proposito (AbortController),
 * por exemplo porque o utilizador mudou de periodo antes da resposta chegar.
 * Nao e uma falha: nao se mostra erro nem se limpa o estado.
 */
export function isRequestCanceled(error: unknown): boolean {
  return axios.isCancel(error);
}
