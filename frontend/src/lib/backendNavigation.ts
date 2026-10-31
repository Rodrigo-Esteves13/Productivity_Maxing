import type { MouseEvent } from 'react';
import { ensureFreshSession } from '../api/userService';
import { rememberCurrentPage } from './postAuthRedirect';

/**
 * Abre um fluxo do backend que exige sessao (ex: /auth/google/link-calendar)
 * por navegacao de pagina inteira. Nesse caso o cliente HTTP nao consegue
 * renovar o JWT de acesso (15 min) se ja tiver expirado, e o backend
 * respondia 401 numa pagina em branco. Por isso renova primeiro (um pedido
 * autenticado barato) e so depois navega. Usado como onClick de um <a href>:
 * sem JS, o link continua a funcionar como antes.
 */
export async function openAuthenticatedBackendFlow(event: MouseEvent<HTMLAnchorElement>): Promise<void> {
  const href = event.currentTarget.href;
  event.preventDefault();
  rememberCurrentPage();
  try {
    await ensureFreshSession();
  } catch {
    // Sem sessao valida o interceptor ja manda para o login; navegar na
    // mesma deixa o backend decidir (como antes desta funcao existir).
  }
  window.location.href = href;
}
