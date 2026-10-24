import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MAX_ATTACHMENTS_PER_TASK,
  removeTaskAttachmentFiles,
  TaskAttachmentsService,
} from './task-attachments.service';
import type { PrismaService } from '../prisma/prisma.service';

// file-type e ESM puro e o jest nao o carrega; aqui nao e usado.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
// Sem o cliente real do Supabase (arranca o Realtime, ver notebook.service.spec).
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

describe('TaskAttachmentsService ownership', () => {
  const setup = (task: unknown, count = 0) => {
    const prisma = {
      task: { findFirst: jest.fn().mockResolvedValue(task) },
      taskAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(count),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    const service = new TaskAttachmentsService(
      prisma as unknown as PrismaService,
    );
    return { prisma, service };
  };
  const file = { originalname: 'brief.pdf', buffer: Buffer.from('x') };

  it('lists only after checking the task belongs to the user', async () => {
    const { prisma, service } = setup(null);
    await expect(service.list('u1', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', userId: 'u1' } }),
    );
    expect(prisma.taskAttachment.findMany).not.toHaveBeenCalled();
  });

  it('refuses uploads to another user task', async () => {
    const { prisma, service } = setup(null);
    await expect(
      service.upload('u1', 't1', file as Express.Multer.File),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.taskAttachment.create).not.toHaveBeenCalled();
  });

  it('caps the number of files per task', async () => {
    const { service } = setup({ id: 't1' }, MAX_ATTACHMENTS_PER_TASK);
    await expect(
      service.upload('u1', 't1', file as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only deletes a file scoped to the user and task', async () => {
    const { prisma, service } = setup({ id: 't1' });
    await expect(service.remove('u1', 't1', 'a1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taskAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1', taskId: 't1', userId: 'u1' },
      }),
    );
    expect(prisma.taskAttachment.delete).not.toHaveBeenCalled();
  });
});

describe('removeTaskAttachmentFiles', () => {
  it('removes the stored files of the user tasks only', async () => {
    const prisma = {
      taskAttachment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ storagePath: 'tasks/u1/a.pdf' }]),
      },
    };
    const remove = jest.fn().mockResolvedValue({ error: null });
    const storage = { storage: { from: () => ({ remove }) } };
    await removeTaskAttachmentFiles(prisma as never, storage as never, 'u1', [
      't1',
      't2',
    ]);
    expect(prisma.taskAttachment.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', taskId: { in: ['t1', 't2'] } },
      select: { storagePath: true },
    });
    expect(remove).toHaveBeenCalledWith(['tasks/u1/a.pdf']);
  });
});
