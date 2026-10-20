import { NotebookService } from './notebook.service';
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

function setup(rows: unknown[], second: unknown[] = []) {
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';

  const findMany = jest
    .fn()
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(second);
  const prisma = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: 'area-1' }) },
    notebookEntry: { findMany },
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
  return { service, findMany, from, createSignedUrls };
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

    const result = await service.listSummariesForArea('user-1', 'area-1');

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
  const candidates = [
    {
      id: 'n1',
      title: 'Redes',
      textContent: null,
      date: new Date('2026-10-02'),
      area: { name: 'CDR' },
    },
    {
      id: 'n2',
      title: 'Outra',
      textContent: 'nada',
      date: new Date('2026-10-01'),
      area: { name: 'BD' },
    },
    {
      id: 'n3',
      title: 'Aula',
      textContent: 'protocolo de redes',
      date: new Date('2026-09-30'),
      area: { name: 'CDR' },
    },
  ];

  it('loads full rows only for the matches, in date order', async () => {
    const { service, findMany } = setup(candidates, [
      { ...entry('n3', []), area: { id: 'a', name: 'CDR', colorHex: null } },
      { ...entry('n1', []), area: { id: 'a', name: 'CDR', colorHex: null } },
    ]);

    const result = await service.search('user-1', 'redes');

    expect(findMany).toHaveBeenCalledTimes(2);
    const firstArgs = (findMany.mock.calls[0] as [{ select: object }])[0];
    expect(Object.keys(firstArgs.select)).not.toContain('drawingStrokes');
    const secondArgs = (
      findMany.mock.calls[1] as [{ where: { id: { in: string[] } } }]
    )[0];
    expect(secondArgs.where.id.in).toEqual(['n1', 'n3']);
    expect(result.map((r) => r.id)).toEqual(['n1', 'n3']);
  });

  it('skips the second query when nothing matches', async () => {
    const { service, findMany } = setup(candidates);

    expect(await service.search('user-1', 'xyz')).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
