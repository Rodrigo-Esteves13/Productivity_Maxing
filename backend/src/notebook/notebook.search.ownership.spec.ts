// Pesquisa do caderno: sempre do proprio user (nunca entradas partilhadas
// ou de outros), parametrizada pelo Prisma e com limites. Prisma mockado.
import { NotebookService } from './notebook.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function setup(rows: unknown[] = [], dateRows: unknown[] = []) {
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';
  // A leitura de datas seleciona so (id, date); a principal tem title.
  const findMany = jest.fn((args: { select: Record<string, unknown> }) =>
    Promise.resolve('title' in args.select ? rows : dateRows),
  );
  const prisma = { notebookEntry: { findMany } };
  const service = new NotebookService(
    prisma as unknown as PrismaService,
    {} as PushService,
  );
  return { service, findMany };
}

type Args = {
  where: { userId: string; OR: Record<string, unknown>[] };
  take: number;
  select: Record<string, unknown>;
};
const argsOf = (mock: jest.Mock, call = 0) =>
  (mock.mock.calls[call] as [Args])[0];

const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  areaId: 'a',
  title: 'T',
  entryType: 'NOTE',
  classNumber: null,
  date: new Date('2026-10-02T00:00:00.000Z'),
  textContent: null,
  area: { id: 'a', name: 'A', colorHex: '#fff' },
  _count: { photos: 0, attachments: 0 },
  ...over,
});

describe('NotebookService.search ownership and edge cases', () => {
  it('blank or whitespace query returns [] with no query', async () => {
    const { service, findMany } = setup();
    expect(await service.search('u1', '')).toEqual([]);
    expect(await service.search('u1', '   \t ')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('userId is the top-level filter, so shared or foreign entries never match', async () => {
    const { service, findMany } = setup();
    await service.search('u1', 'redes');
    const { where } = argsOf(findMany);
    expect(where.userId).toBe('u1');
    // O OR so contem condicoes de texto, nunca um owner alternativo.
    for (const clause of where.OR) {
      expect(Object.keys(clause)).not.toContain('userId');
      expect(Object.keys(clause)).not.toContain('shares');
    }
  });

  it('SQL-looking input stays a plain contains value (parameterised by Prisma)', async () => {
    const { service, findMany } = setup();
    const evil = `'; DROP TABLE "NotebookEntry"; --`;
    await service.search('u1', evil);
    expect(argsOf(findMany).where.OR[0]).toEqual({
      title: { contains: evil, mode: 'insensitive' },
    });
  });

  it('LIKE wildcards are passed through as a literal value', async () => {
    const { service, findMany } = setup();
    await service.search('u1', '100%_');
    expect(argsOf(findMany).where.OR[1]).toEqual({
      textContent: { contains: '100%_', mode: 'insensitive' },
    });
  });

  it('trims the query before searching', async () => {
    const { service, findMany } = setup();
    await service.search('u1', '  abc  ');
    expect(argsOf(findMany).where.OR[0]).toEqual({
      title: { contains: 'abc', mode: 'insensitive' },
    });
  });

  it('date lookup reads only the caller entries and ids go into the main filter', async () => {
    const { service, findMany } = setup(
      [row({ id: 'n2' })],
      [
        { id: 'n2', date: new Date('2026-10-02T00:00:00.000Z') },
        { id: 'n3', date: new Date('2026-11-05T00:00:00.000Z') },
      ],
    );
    await service.search('u1', '02/10');
    expect(argsOf(findMany, 0).where).toEqual({ userId: 'u1' });
    const main = argsOf(findMany, 1);
    expect(main.where.userId).toBe('u1');
    expect(main.where.OR.find((c) => 'id' in c)).toEqual({
      id: { in: ['n2'] },
    });
  });

  it('a date-shaped query with no matching day adds no id clause', async () => {
    const { service, findMany } = setup(
      [],
      [{ id: 'n3', date: new Date('2026-11-05T00:00:00.000Z') }],
    );
    await service.search('u1', '31/12');
    expect(argsOf(findMany, 1).where.OR.some((c) => 'id' in c)).toBe(false);
  });

  it('never returns the full text, only a capped preview and counts', async () => {
    const long = 'x'.repeat(5000);
    const { service } = setup([
      row({ textContent: long, _count: { photos: 2, attachments: 3 } }),
    ]);
    const [result] = await service.search('u1', 'x');
    expect(result).not.toHaveProperty('textContent');
    expect(result).not.toHaveProperty('_count');
    expect((result.preview ?? '').length).toBeLessThan(long.length);
    expect(result.photoCount).toBe(2);
    expect(result.attachmentCount).toBe(3);
  });

  it('null textContent gives a null preview', async () => {
    const { service } = setup([row()]);
    const [result] = await service.search('u1', 'a');
    expect(result.preview).toBeNull();
  });

  it('selects no photo, attachment or drawing payloads', async () => {
    const { service, findMany } = setup();
    await service.search('u1', 'a');
    const select = argsOf(findMany).select;
    expect(select).not.toHaveProperty('photos');
    expect(select).not.toHaveProperty('attachments');
    expect(select).not.toHaveProperty('drawing');
  });
});
