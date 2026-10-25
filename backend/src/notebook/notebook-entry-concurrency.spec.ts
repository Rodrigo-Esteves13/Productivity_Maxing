import { ConflictException } from '@nestjs/common';
import {
  NOTEBOOK_ENTRY_CONFLICT_CODE,
  NotebookService,
} from './notebook.service';
import { NotebookCollabService } from './notebook-collab.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

// C-01: um co-owner grava pela partilha enquanto o dono tem o editor aberto.
// O dono (ou o co-owner) a gravar sobre uma versao antiga recebe 409 com a
// versao atual, em vez de apagar a alteracao do outro sem aviso.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const OLD = '2026-10-01T10:00:00.000Z';
const NEW = new Date('2026-10-01T10:05:00.000Z');

function ownerSetup(updatedCount: number) {
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';
  const row = {
    id: 'e1',
    userId: 'u1',
    title: 'Co-owner title',
    updatedAt: NEW,
    photos: [],
    attachments: [],
  };
  const prisma = {
    notebookEntry: {
      findFirst: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: updatedCount }),
      update: jest.fn().mockResolvedValue(row),
    },
  };
  const service = new NotebookService(
    prisma as unknown as PrismaService,
    {} as PushService,
  );
  return { service, prisma };
}

describe('NotebookService.update optimistic concurrency', () => {
  it('writes only where updatedAt still matches the base version', async () => {
    const { service, prisma } = ownerSetup(1);
    await service.update('u1', 'e1', {
      title: 'Mine',
      baseUpdatedAt: OLD,
    });

    expect(prisma.notebookEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1', userId: 'u1', updatedAt: new Date(OLD) },
      }),
    );
    expect(prisma.notebookEntry.update).not.toHaveBeenCalled();
  });

  it('answers 409 with the current entry when someone saved in between', async () => {
    const { service } = ownerSetup(0);
    const attempt = service.update('u1', 'e1', {
      title: 'Mine',
      baseUpdatedAt: OLD,
    });

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: {
        code: NOTEBOOK_ENTRY_CONFLICT_CODE,
        current: { id: 'e1', title: 'Co-owner title', updatedAt: NEW },
      },
    });
  });

  it('keeps saving without a base version (older clients)', async () => {
    const { service, prisma } = ownerSetup(1);
    await service.update('u1', 'e1', {
      title: 'Mine',
    });
    expect(prisma.notebookEntry.update).toHaveBeenCalled();
    expect(prisma.notebookEntry.updateMany).not.toHaveBeenCalled();
  });
});

describe('NotebookCollabService.editShared optimistic concurrency', () => {
  function collabSetup(updatedCount: number) {
    const prisma = {
      notebookShare: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          token: 't',
          notebookEntryId: 'e1',
          createdByUserId: 'u1',
          visibility: 'AUTHORIZED',
        }),
      },
      notebookEntry: {
        updateMany: jest.fn().mockResolvedValue({ count: updatedCount }),
        findUnique: jest.fn().mockResolvedValue({
          title: 'Owner title',
          textContent: 'owner text',
          usefulLinks: [],
          updatedAt: NEW,
        }),
      },
    };
    // O dono a editar pela propria partilha resolve como OWNER sem mais
    // consultas (share-role.util), o mesmo caminho do CO_OWNER.
    const service = new NotebookCollabService(
      prisma as unknown as PrismaService,
      {} as PushService,
    );
    return { service, prisma };
  }

  it('rejects a direct edit made on top of an older version', async () => {
    const { service, prisma } = collabSetup(0);
    const attempt = service.editShared('u1', 't', {
      textContent: 'stale form text',
      baseUpdatedAt: OLD,
    });
    await expect(attempt).rejects.toMatchObject({
      response: {
        code: NOTEBOOK_ENTRY_CONFLICT_CODE,
        current: { textContent: 'owner text' },
      },
    });
    expect(prisma.notebookEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1', updatedAt: new Date(OLD) },
      }),
    );
  });

  it('applies the edit when the version still matches', async () => {
    const { service } = collabSetup(1);
    await expect(
      service.editShared('u1', 't', {
        textContent: 'new',
        baseUpdatedAt: OLD,
      }),
    ).resolves.toEqual({ applied: true });
  });
});
