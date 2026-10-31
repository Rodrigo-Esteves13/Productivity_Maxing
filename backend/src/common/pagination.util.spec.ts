import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import {
  DEFAULT_PAGE_LIMIT,
  LEGACY_LIST_CAP,
  listOrPage,
  paginate,
} from './pagination.util';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `id-${i + 1}` }));

// Simula o findMany: aplica cursor/skip/take sobre uma tabela de `total` linhas.
function fakeFind(total: number) {
  const table = rows(total);
  return jest.fn(
    ({
      take,
      skip = 0,
      cursor,
    }: {
      take: number;
      skip?: number;
      cursor?: { id: string };
    }) => {
      const start = cursor
        ? table.findIndex((r) => r.id === cursor.id) + skip
        : 0;
      return Promise.resolve(table.slice(start, start + take));
    },
  );
}

const anyExists = () => Promise.resolve(true);
const opts = { cursorExists: anyExists };

describe('paginate', () => {
  it('first page without cursor: asks limit+1, no skip/cursor', async () => {
    const find = fakeFind(10);
    const page = await paginate(find, { limit: 3 }, anyExists);
    expect(find).toHaveBeenCalledWith({ take: 4 });
    expect(page.items.map((r) => r.id)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(page.nextCursor).toBe('id-3');
  });

  it('with cursor: skips the cursor row itself', async () => {
    const find = fakeFind(10);
    const page = await paginate(find, { limit: 3, cursor: 'id-3' }, anyExists);
    expect(find).toHaveBeenCalledWith({
      take: 4,
      skip: 1,
      cursor: { id: 'id-3' },
    });
    expect(page.items.map((r) => r.id)).toEqual(['id-4', 'id-5', 'id-6']);
    expect(page.nextCursor).toBe('id-6');
  });

  it('empty page: no items, null cursor', async () => {
    const page = await paginate(fakeFind(0), { limit: 5 }, anyExists);
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('exactly limit rows: last page, null cursor', async () => {
    const page = await paginate(fakeFind(3), { limit: 3 }, anyExists);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('limit+1 rows: trims the extra row and returns a cursor', async () => {
    const page = await paginate(fakeFind(4), { limit: 3 }, anyExists);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBe('id-3');
  });

  it('walks the whole table with no gaps or repeats', async () => {
    const find = fakeFind(7);
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await paginate(find, { limit: 3, cursor }, anyExists);
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(rows(7).map((r) => r.id));
  });

  it('defaults to DEFAULT_PAGE_LIMIT', async () => {
    const find = fakeFind(0);
    await paginate(find, {}, anyExists);
    expect(find).toHaveBeenCalledWith({ take: DEFAULT_PAGE_LIMIT + 1 });
  });
});

describe('listOrPage', () => {
  it('no cursor/paginated: plain array capped at LEGACY_LIST_CAP', async () => {
    const find = fakeFind(3);
    const result = await listOrPage(find, {}, opts);
    expect(find).toHaveBeenCalledWith({ take: LEGACY_LIST_CAP + 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it('no cursor/paginated: explicit limit is the cap, still an array', async () => {
    const result = await listOrPage(fakeFind(5), { limit: 2 }, opts);
    expect(result).toEqual([{ id: 'id-1' }, { id: 'id-2' }]);
  });

  it('paginated=true returns the envelope from the first page', async () => {
    const result = await listOrPage(
      fakeFind(5),
      {
        paginated: true,
        limit: 2,
      },
      opts,
    );
    expect(result).toEqual({
      items: [{ id: 'id-1' }, { id: 'id-2' }],
      nextCursor: 'id-2',
    });
  });

  it('cursor returns the envelope', async () => {
    const result = await listOrPage(
      fakeFind(5),
      {
        cursor: 'id-4',
        limit: 2,
      },
      opts,
    );
    expect(result).toEqual({ items: [{ id: 'id-5' }], nextCursor: null });
  });
});

describe('cursor validation and truncation', () => {
  it('unknown/deleted cursor: 400 Invalid cursor, no query run', async () => {
    const find = fakeFind(5);
    const missing = jest.fn().mockResolvedValue(false);
    await expect(
      paginate(find, { cursor: 'gone', limit: 2 }, missing),
    ).rejects.toThrow(new BadRequestException('Invalid cursor'));
    expect(missing).toHaveBeenCalledWith('gone');
    expect(find).not.toHaveBeenCalled();
  });

  it('other user cursor (not in scoped lookup): 400 via listOrPage', async () => {
    const scoped = new Set(['id-1', 'id-2']);
    const cursorExists = (id: string) => Promise.resolve(scoped.has(id));
    await expect(
      listOrPage(fakeFind(5), { cursor: 'foreign-id' }, { cursorExists }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valid cursor in scope: proceeds', async () => {
    const cursorExists = jest.fn().mockResolvedValue(true);
    const result = await paginate(
      fakeFind(5),
      { cursor: 'id-2', limit: 2 },
      cursorExists,
    );
    expect(result.items.map((r) => r.id)).toEqual(['id-3', 'id-4']);
  });

  it('no cursor: never calls cursorExists', async () => {
    const cursorExists = jest.fn();
    await paginate(fakeFind(3), { limit: 2 }, cursorExists);
    expect(cursorExists).not.toHaveBeenCalled();
  });

  it('array mode over the cap: trims to cap and flags truncated', async () => {
    const meta: { truncated?: boolean } = {};
    const result = (await listOrPage(
      fakeFind(LEGACY_LIST_CAP + 5),
      {},
      { ...opts, meta },
    )) as unknown[];
    expect(result).toHaveLength(LEGACY_LIST_CAP);
    expect(meta.truncated).toBe(true);
  });

  it('array mode exactly at the cap: not truncated', async () => {
    const meta: { truncated?: boolean } = {};
    const result = (await listOrPage(
      fakeFind(LEGACY_LIST_CAP),
      {},
      { ...opts, meta },
    )) as unknown[];
    expect(result).toHaveLength(LEGACY_LIST_CAP);
    expect(meta.truncated).toBeUndefined();
  });
});

describe('CursorPaginationDto', () => {
  const check = (plain: Record<string, unknown>) =>
    validate(plainToInstance(CursorPaginationDto, plain));

  it('accepts an empty query (backward compatible)', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts string numbers and paginated=true from the query string', async () => {
    const dto = plainToInstance(CursorPaginationDto, {
      limit: '50',
      paginated: 'true',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(dto.paginated).toBe(true);
  });

  it('rejects limit above the max, below 1 and non-integers', async () => {
    expect(await check({ limit: '201' })).not.toHaveLength(0);
    expect(await check({ limit: '200' })).toHaveLength(0);
    expect(await check({ limit: '0' })).not.toHaveLength(0);
    expect(await check({ limit: '1.5' })).not.toHaveLength(0);
  });

  it('rejects an oversized cursor and a bad paginated flag', async () => {
    expect(await check({ cursor: 'x'.repeat(65) })).not.toHaveLength(0);
    expect(await check({ paginated: 'maybe' })).not.toHaveLength(0);
  });
});
