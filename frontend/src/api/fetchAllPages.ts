import axios from 'axios';
import api from './client';

// Tamanho de pagina pedido ao backend (maximo aceite pelo DTO) e teto de
// seguranca de paginas: 100 x 200 = 20000 itens, contra um nextCursor que
// nunca chegue a null.
export const PAGE_LIMIT = 200;
export const MAX_PAGES = 100;

interface PageEnvelope<T> {
  items: T[];
  nextCursor: string | null;
}

const HTTP_BAD_REQUEST = 400;

/**
 * Le uma lista inteira seguindo as paginas de cursor do backend
 * (?paginated=true&limit=200&cursor=) e devolve o mesmo array que o endpoint
 * em modo array devolvia, sem o corte silencioso do teto de 1000.
 * Um cursor invalido (400, ex.: linha apagada entre paginas) reinicia a
 * leitura desde a 1a pagina uma unica vez; qualquer outro erro propaga.
 * Uma linha que mudou de posicao entre paginas (ex: reordenada noutra tab)
 * pode vir em duas paginas: fica so a primeira (ids repetidos partiam as
 * keys do React).
 */
export async function fetchAllPages<T extends { id: string }>(
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  let restarted = false;
  let items: T[] = [];
  let seen = new Set<string>();
  let cursor: string | null = null;

  for (let pageCount = 0; pageCount < MAX_PAGES; pageCount += 1) {
    try {
      const response: { data: PageEnvelope<T> } = await api.get<PageEnvelope<T>>(path, {
        params: {
          ...params,
          paginated: true,
          limit: PAGE_LIMIT,
          ...(cursor ? { cursor } : {}),
        },
        signal,
      });
      for (const item of response.data.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
      cursor = response.data.nextCursor;
      if (!cursor) return items;
    } catch (error) {
      const invalidCursor =
        cursor !== null &&
        !restarted &&
        axios.isAxiosError(error) &&
        error.response?.status === HTTP_BAD_REQUEST;
      if (!invalidCursor) throw error;
      restarted = true;
      items = [];
      seen = new Set<string>();
      cursor = null;
      pageCount = -1;
    }
  }
  return items;
}
