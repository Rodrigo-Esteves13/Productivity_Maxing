import { TurmaRole } from '@prisma/client';
import { releaseTurmasOfDeletedUser } from './turma-account-cleanup.util';
import type { PrismaService } from '../prisma/prisma.service';

const setup = (
  memberships: { turmaId: string; role: TurmaRole }[],
  successor: { id: string } | null,
) => {
  const remove = jest.fn().mockResolvedValue({ error: null });
  const prisma = {
    turmaMember: {
      findMany: jest.fn().mockResolvedValue(memberships),
      findFirst: jest.fn().mockResolvedValue(successor),
      update: jest.fn(),
    },
    turmaFile: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ storagePath: 'turmas/t1/a.pdf' }]),
    },
    turma: { delete: jest.fn() },
  };
  const storage = { storage: { from: jest.fn(() => ({ remove })) } };
  const run = () =>
    releaseTurmasOfDeletedUser(
      prisma as unknown as PrismaService,
      storage as never,
      'u1',
    );
  return { prisma, remove, run };
};

describe('releaseTurmasOfDeletedUser', () => {
  it('deletes a turma (and its files) when the user was its only member', async () => {
    const { prisma, remove, run } = setup(
      [{ turmaId: 't1', role: TurmaRole.DELEGADO }],
      null,
    );
    await run();
    expect(remove).toHaveBeenCalledWith(['turmas/t1/a.pdf']);
    expect(prisma.turma.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  it('hands the delegado role to the oldest other member', async () => {
    const { prisma, run } = setup(
      [{ turmaId: 't1', role: TurmaRole.DELEGADO }],
      { id: 'm2' },
    );
    await run();
    expect(prisma.turmaMember.update).toHaveBeenCalledWith({
      where: { id: 'm2' },
      data: { role: TurmaRole.DELEGADO },
    });
    expect(prisma.turma.delete).not.toHaveBeenCalled();
  });

  it('leaves the turma alone when a regular member deletes their account', async () => {
    const { prisma, run } = setup([{ turmaId: 't1', role: TurmaRole.MEMBER }], {
      id: 'm2',
    });
    await run();
    expect(prisma.turmaMember.update).not.toHaveBeenCalled();
    expect(prisma.turma.delete).not.toHaveBeenCalled();
  });

  it('stops before deleting the turma when the storage fails', async () => {
    const { prisma, remove, run } = setup(
      [{ turmaId: 't1', role: TurmaRole.DELEGADO }],
      null,
    );
    remove.mockResolvedValue({ error: new Error('storage down') });
    await expect(run()).rejects.toThrow('storage down');
    expect(prisma.turma.delete).not.toHaveBeenCalled();
  });
});
