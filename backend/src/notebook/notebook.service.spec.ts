import { BadRequestException } from '@nestjs/common';
import { NotebookService, type NotebookEntrySummary } from './notebook.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchNotebookQueryDto } from './dto/search-notebook-query.dto';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

// file-type e ESM puro e o jest nao o carrega; aqui nao e usado.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
// O cliente real do Supabase arranca o Realtime, que exige WebSocket nativo
// (Node 22+) e falhava no CI. O Storage e trocado por um falso em setup().
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

interface SignedItem {
  error: string | null;
  path: string | null;
  signedUrl: string | null;
}

function entry(id: string, photos: string[], attachments: string[] = []) {
  return {
    id,
    title: `Aula ${id}`,
    photos: photos.map((path, i) => ({ id: `${id}-p${i}`, storagePath: path })),
    attachments: attachments.map((path, i) => ({
      id: `${id}-a${i}`,
      storagePath: path,
      originalFileName: `relatório ${i}.pdf`,
    })),
  };
}

function setup(rows: unknown[], second: unknown[] = [], cursorFound = true) {
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';

  const findMany = jest
    .fn()
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(second);
  const prisma = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: 'area-1' }) },
    notebookEntry: {
      findMany,
      findFirst: jest
        .fn()
        .mockResolvedValue(cursorFound ? { id: 'cursor' } : null),
    },
  };

  // O Storage assina tudo menos os caminhos com "missing" no nome.
  const createSignedUrls = jest.fn((paths: string[]) =>
    Promise.resolve({
      data: paths.map<SignedItem>((path) =>
        path.includes('missing')
          ? { error: 'Object not found', path, signedUrl: null }
          : { error: null, path, signedUrl: `https://cdn/${path}?token=t` },
      ),
      error: null,
    }),
  );
  const from = jest.fn(() => ({ createSignedUrls }));

  const service = new NotebookService(
    prisma as unknown as PrismaService,
    {} as PushService,
  );
  Object.assign(service, { storage: { storage: { from } } });
  return { service, findMany, from, createSignedUrls, prisma };
}

describe('NotebookService signed URLs', () => {
  it('signs a whole notebook with one request per bucket', async () => {
    const { service, createSignedUrls } = setup([
      entry('e1', ['u/1.png', 'u/2.png'], ['u/doc.pdf']),
      entry('e2', ['u/3.png', 'u/missing.png']),
      entry('e3', []),
    ]);

    const result = await service.findAllForArea('user-1', 'area-1');

    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    const [photoPaths] = createSignedUrls.mock.calls[0];
    expect(photoPaths).toEqual([
      'u/1.png',
      'u/2.png',
      'u/3.png',
      'u/missing.png',
    ]);
    expect(result[0].photos.map((p) => p.url)).toEqual([
      'https://cdn/u/1.png?token=t',
      'https://cdn/u/2.png?token=t',
    ]);
    // Um ficheiro que o Storage nao assinou fica sem URL, o resto continua.
    expect(result[1].photos.map((p) => p.url)).toEqual([
      'https://cdn/u/3.png?token=t',
      null,
    ]);
    expect(result[2].photos).toEqual([]);
  });

  it('keeps the download name storage-js would add for each attachment', async () => {
    const { service } = setup([entry('e1', [], ['u/doc.pdf'])]);

    const [signed] = await service.findAllForArea('user-1', 'area-1');

    // O mesmo que createSignedUrl(path, ttl, { download: nome }) devolve.
    const query = new URLSearchParams({ download: 'relatório 0.pdf' });
    expect(signed.attachments[0].url).toBe(
      `https://cdn/u/doc.pdf?token=t${encodeURI(`&${query.toString()}`)}`,
    );
  });

  it('makes no Storage request when nothing has files', async () => {
    const { service, createSignedUrls } = setup([entry('e1', [])]);

    await service.findAllForArea('user-1', 'area-1');

    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

describe('NotebookService.listSummariesForArea', () => {
  it('returns the list without content, with a preview and file counts', async () => {
    const long = 'x'.repeat(1000);
    const { service, findMany, createSignedUrls } = setup([
      {
        id: 'e1',
        areaId: 'area-1',
        title: 'Aula 3',
        entryType: 'CLASS',
        classNumber: 3,
        date: new Date('2026-10-01'),
        textContent: long,
        _count: { photos: 2, attachments: 1 },
      },
      {
        id: 'e2',
        areaId: 'area-1',
        title: 'Nota',
        entryType: 'NOTE',
        classNumber: null,
        date: new Date('2026-09-30'),
        textContent: null,
        _count: { photos: 0, attachments: 0 },
      },
    ]);

    const result = (await service.listSummariesForArea(
      'user-1',
      'area-1',
    )) as NotebookEntrySummary[];

    const args = (findMany.mock.calls[0] as [{ select: object }])[0];
    expect(Object.keys(args.select)).not.toContain('drawingStrokes');
    expect(Object.keys(args.select)).not.toContain('tables');
    // Sem fotos assinadas: a lista nao as mostra.
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(result[0].preview).toHaveLength(400);
    expect(result[0]).toMatchObject({ photoCount: 2, attachmentCount: 1 });
    expect(result[0]).not.toHaveProperty('textContent');
    expect(result[0]).not.toHaveProperty('_count');
    expect(result[1]).toMatchObject({
      preview: null,
      photoCount: 0,
      attachmentCount: 0,
    });
  });
});

describe('NotebookService.search', () => {
  const row = (id: string, textContent: string | null = null) => ({
    id,
    areaId: 'a',
    title: `Aula ${id}`,
    entryType: 'NOTE',
    classNumber: null,
    date: new Date('2026-10-02'),
    textContent,
    area: { id: 'a', name: 'CDR', colorHex: '#fff' },
    _count: { photos: 1, attachments: 0 },
  });

  it('filters in SQL scoped by userId, capped at 50, and returns light summaries', async () => {
    const { service, findMany, createSignedUrls } = setup([
      row('n1', 'protocolo de redes'),
    ]);

    const result = await service.search('user-1', ' redes ');

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = (
      findMany.mock.calls[0] as [
        { where: { userId: string; OR: unknown[] }; take: number },
      ]
    )[0];
    expect(args.where.userId).toBe('user-1');
    expect(args.take).toBe(50);
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { title: { contains: 'redes', mode: 'insensitive' } },
        { textContent: { contains: 'redes', mode: 'insensitive' } },
        { area: { name: { contains: 'redes', mode: 'insensitive' } } },
      ]),
    );
    // Sem desenhos, fotos nem URLs assinados.
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: 'n1',
      preview: 'protocolo de redes',
      photoCount: 1,
      area: { name: 'CDR' },
    });
    expect(result[0]).not.toHaveProperty('textContent');
  });

  it('keeps the dd/mm/yyyy date search for digit-and-slash queries', async () => {
    const dates = [
      { id: 'n1', date: new Date('2026-10-02T12:00:00Z') },
      { id: 'n2', date: new Date('2026-09-30T12:00:00Z') },
    ];
    const { service, findMany } = setup(dates, [row('n1')]);

    const result = await service.search('user-1', '02/10/2026');

    expect(findMany).toHaveBeenCalledTimes(2);
    const second = (
      findMany.mock.calls[1] as [{ where: { OR: { id?: { in: string[] } }[] } }]
    )[0];
    expect(second.where.OR).toContainEqual({ id: { in: ['n1'] } });
    expect(result.map((r) => r.id)).toEqual(['n1']);
  });

  it('empty query returns nothing without touching the database', async () => {
    const { service, findMany } = setup([]);
    expect(await service.search('user-1', '   ')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('SearchNotebookQueryDto', () => {
  it('rejects queries longer than 200 characters', async () => {
    const dto = plainToInstance(SearchNotebookQueryDto, { q: 'x'.repeat(201) });
    expect(await validate(dto)).toHaveLength(1);
  });

  it('accepts a normal query and a missing one', async () => {
    expect(
      await validate(plainToInstance(SearchNotebookQueryDto, { q: 'redes' })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(SearchNotebookQueryDto, {})),
    ).toHaveLength(0);
  });
});

describe('NotebookService pagination', () => {
  const row = (id: string) => ({
    id,
    areaId: 'area-1',
    title: id,
    entryType: 'NOTE',
    classNumber: null,
    date: new Date('2026-10-01'),
    textContent: null,
    _count: { photos: 0, attachments: 0 },
  });

  it('summaries: no cursor keeps the array, scoped by userId, id tiebreaker', async () => {
    const { service, findMany } = setup([row('e1')]);
    const result = await service.listSummariesForArea('user-1', 'area-1');
    expect(Array.isArray(result)).toBe(true);
    expect((findMany.mock.calls[0] as unknown[])[0]).toMatchObject({
      where: { userId: 'user-1', areaId: 'area-1' },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      take: 1001,
    });
  });

  it('summaries: cursor returns the envelope and trims the extra row', async () => {
    const { service, findMany } = setup([row('e2'), row('e3'), row('e4')]);
    const result = await service.listSummariesForArea('user-1', 'area-1', {
      cursor: 'e1',
      limit: 2,
    });
    expect((findMany.mock.calls[0] as unknown[])[0]).toMatchObject({
      take: 3,
      skip: 1,
      cursor: { id: 'e1' },
    });
    expect(result).toMatchObject({ nextCursor: 'e3' });
    expect((result as { items: unknown[] }).items).toHaveLength(2);
  });

  it('entries: paginated=true returns the envelope with a cursor', async () => {
    const { service } = setup([
      entry('e1', []),
      entry('e2', []),
      entry('e3', []),
    ]);
    const result = await service.findAllForArea('user-1', 'area-1', {
      paginated: true,
      limit: 2,
    });
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({ nextCursor: 'e2' });
  });
});

describe('NotebookService cursor validation', () => {
  it('summaries: unknown/deleted/foreign cursor gives 400 and no list query', async () => {
    const { service, findMany } = setup([], [], false);
    await expect(
      service.listSummariesForArea('user-1', 'area-1', { cursor: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('entries: unknown cursor gives 400', async () => {
    const { service } = setup([], [], false);
    await expect(
      service.findAllForArea('user-1', 'area-1', { cursor: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valid cursor is looked up scoped by user and area', async () => {
    const { service, prisma } = setup([], [], true);
    await service.listSummariesForArea('user-1', 'area-1', { cursor: 'e1' });
    expect(prisma.notebookEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', areaId: 'area-1', id: 'e1' },
      select: { id: true },
    });
  });

  it('entries: the cursor is looked up scoped by user and area too', async () => {
    const { service, prisma } = setup([], [], true);
    await service.findAllForArea('user-1', 'area-1', { cursor: 'e1' });
    expect(prisma.notebookEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', areaId: 'area-1', id: 'e1' },
      select: { id: true },
    });
  });
});
