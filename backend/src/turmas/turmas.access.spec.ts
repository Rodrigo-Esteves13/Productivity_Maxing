// file-type e ESM puro e o jest nao o carrega; aqui nao e usado.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TurmaRole } from '@prisma/client';
import { TurmaAccessService } from './turma-access.service';
import { TurmaNotesService } from './turma-notes.service';
import { TurmasService } from './turmas.service';
import type { TurmaFilesService } from './turma-files.service';
import type { PrismaService } from '../prisma/prisma.service';

const membership = (role: TurmaRole, membersCanEditNotes = true) => ({
  role,
  turma: { id: 't1', name: 'Turma', membersCanEditNotes },
});

const setup = () => {
  const prisma = {
    turmaMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    turmaLinkedArea: { deleteMany: jest.fn() },
    turmaNote: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    },
    turma: { delete: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([{ count: 0 }, { count: 1 }]),
  };
  const access = new TurmaAccessService(prisma as unknown as PrismaService);
  const notes = new TurmaNotesService(
    prisma as unknown as PrismaService,
    access,
  );
  const files = { removeAllFor: jest.fn() };
  const turmas = new TurmasService(
    prisma as unknown as PrismaService,
    access,
    files as unknown as TurmaFilesService,
  );
  return { prisma, access, notes, turmas, files };
};

describe('Turma access', () => {
  it('a non-member gets 404, never the turma', async () => {
    const { access } = setup();
    await expect(access.requireMember('u1', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a member cannot do delegado-only actions', async () => {
    const { access, prisma } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.MEMBER),
    );
    await expect(access.requireDelegado('u1', 't1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('members cannot create notes when the delegado turned editing off', async () => {
    const { notes, prisma } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.MEMBER, false),
    );
    await expect(
      notes.create('u1', 't1', { title: 'Resumo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.turmaNote.create).not.toHaveBeenCalled();
  });

  it('a member cannot delete a note written by someone else', async () => {
    const { notes, prisma } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.MEMBER),
    );
    prisma.turmaNote.findFirst.mockResolvedValue({
      id: 'n1',
      createdById: 'u2',
      updatedAt: new Date(),
      updatedBy: null,
    });
    await expect(notes.remove('u1', 't1', 'n1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.turmaNote.delete).not.toHaveBeenCalled();
  });

  it('notes of another turma are a 404', async () => {
    const { notes, prisma } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.DELEGADO),
    );
    await expect(notes.get('u1', 't1', 'n-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.turmaNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-other', turmaId: 't1' } }),
    );
  });
});

describe('Leaving a turma', () => {
  it('the delegado must hand over the role before leaving', async () => {
    const { turmas, prisma } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.DELEGADO),
    );
    prisma.turmaMember.count.mockResolvedValue(3);
    await expect(turmas.leave('u1', 't1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('the last member leaving deletes the turma and its files', async () => {
    const { turmas, prisma, files } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(
      membership(TurmaRole.DELEGADO),
    );
    prisma.turmaMember.count.mockResolvedValue(0);
    await expect(turmas.leave('u1', 't1')).resolves.toEqual({
      left: true,
      deleted: true,
    });
    expect(files.removeAllFor).toHaveBeenCalledWith('t1');
    expect(prisma.turma.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});
