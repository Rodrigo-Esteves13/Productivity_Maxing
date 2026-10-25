import { Logger } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

// Silent audit (area c), finding C-08: NotebookService.remove() cleans the
// bucket with `.remove(paths).catch(...)`. supabase-js storage never rejects
// on a Storage error - it resolves `{ data: null, error }` - so the catch
// never runs, the files stay in the bucket and nothing is logged.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

describe('NotebookService.remove storage cleanup (silent audit)', () => {
  it('logs when the Storage cleanup fails (supabase resolves { error })', async () => {
    process.env.SUPABASE_URL ??= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';

    const prisma = {
      notebookEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'e1',
          userId: 'u1',
          photos: [{ id: 'p1', storagePath: 'u1/e1/p.png' }],
          attachments: [],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    // Exactly what storage-js 2.x does on a failed remove: resolves, never throws.
    const remove = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage unavailable' },
    });
    const service = new NotebookService(
      prisma as unknown as PrismaService,
      {} as PushService,
    );
    Object.assign(service, {
      storage: { storage: { from: jest.fn(() => ({ remove })) } },
    });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await service.remove('u1', 'e1');
    // Let the fire-and-forget promise settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(remove).toHaveBeenCalledWith(['u1/e1/p.png']);
    // Fails today: the failure is neither thrown nor logged.
    expect(warn.mock.calls.length + error.mock.calls.length).toBeGreaterThan(0);
  });
});
