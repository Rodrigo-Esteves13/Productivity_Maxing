import { BadRequestException } from '@nestjs/common';
import type { CursorPaginationDto } from './dto/cursor-pagination.dto';

// Limite por omissão quando o cliente pede o envelope sem `limit`.
export const DEFAULT_PAGE_LIMIT = 100;
// Teto do array simples (cliente sem cursor/paginated): generoso para não
// mudar o comportamento de quem hoje recebe a lista toda, mas finito.
export const LEGACY_LIST_CAP = 1000;
// Header de resposta que avisa que o array simples foi cortado no teto.
export const RESULT_TRUNCATED_HEADER = 'x-result-truncated';
// Mensagem unica para cursor desconhecido, apagado ou de outro user.
export const INVALID_CURSOR_MESSAGE = 'Invalid cursor';

export interface CursorArgs {
  take: number;
  skip?: number;
  cursor?: { id: string };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// Preenchido por listOrPage no modo array: o controller transforma
// `truncated` no header X-Result-Truncated.
export interface ListMeta {
  truncated?: boolean;
}

export interface ListOptions {
  // true se o id existe DENTRO do where do user (o mesmo where da lista).
  cursorExists: (id: string) => Promise<boolean>;
  meta?: ListMeta;
}

type Pager = Pick<CursorPaginationDto, 'limit' | 'cursor'>;

/**
 * Cursor pagination sobre Prisma. `find` recebe { take, skip, cursor } para
 * espalhar no findMany; o orderBy da query TEM de acabar com `{ id: 'asc' }`
 * (desempate estável) e o where TEM de levar o userId (o cursor só
 * posiciona, nunca alarga o acesso). `cursorExists` valida que o cursor
 * pertence ao âmbito do pedido: senão 400 (cursor desconhecido, apagado
 * entre páginas ou de outro user).
 * Pede limit+1 linhas: se vier a mais, há próxima página e nextCursor é o id
 * da última linha devolvida; na última página é null.
 */
export async function paginate<T extends { id: string }>(
  find: (args: CursorArgs) => Promise<T[]>,
  page: Pager,
  cursorExists: ListOptions['cursorExists'],
): Promise<Page<T>> {
  const limit = page.limit ?? DEFAULT_PAGE_LIMIT;
  if (page.cursor && !(await cursorExists(page.cursor))) {
    throw new BadRequestException(INVALID_CURSOR_MESSAGE);
  }
  const rows = await find({
    take: limit + 1,
    ...(page.cursor ? { skip: 1, cursor: { id: page.cursor } } : {}),
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/**
 * Compatibilidade com o frontend atual:
 *  - sem `cursor` nem `paginated=true` -> array simples (como antes), só com
 *    teto (`limit` ou LEGACY_LIST_CAP). Sem `limit` pedem-se cap+1 linhas para
 *    detetar corte: meta.truncated=true quando havia mais do que o teto;
 *  - com `cursor` ou `paginated=true` -> { items, nextCursor }. O cliente
 *    pede a 1ª página com paginated=true para obter o primeiro nextCursor e
 *    as seguintes com cursor=<nextCursor>.
 */
export async function listOrPage<T extends { id: string }>(
  find: (args: CursorArgs) => Promise<T[]>,
  query: CursorPaginationDto,
  opts: ListOptions,
): Promise<T[] | Page<T>> {
  if (query.cursor || query.paginated) {
    return paginate(find, query, opts.cursorExists);
  }
  if (query.limit) return find({ take: query.limit });
  const rows = await find({ take: LEGACY_LIST_CAP + 1 });
  if (rows.length <= LEGACY_LIST_CAP) return rows;
  if (opts.meta) opts.meta.truncated = true;
  return rows.slice(0, LEGACY_LIST_CAP);
}
