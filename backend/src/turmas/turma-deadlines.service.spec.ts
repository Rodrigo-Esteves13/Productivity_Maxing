import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TurmaRole } from '@prisma/client';
import { TurmaDeadlinesService } from './turma-deadlines.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const TURMA = { id: 't1', name: 'LEI 2', membersCanEditNotes: true };

function setup(role: TurmaRole = TurmaRole.MEMBER) {
  const prisma = {
    turmaDeadline: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    turmaDeadlineTask: { create: jest.fn() },
    task: { updateMany: jest.fn() },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue({ role, turma: TURMA }),
  };
  const tasks = { create: jest.fn() };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new TurmaDeadlinesService(
    prisma as never,
    access as never,
    tasks as never,
    push as never,
  );
  return { service, prisma, tasks, push };
}

describe('TurmaDeadlinesService', () => {
  it('moving the date updates every linked task and warns the others', async () => {
    const { service, prisma, push } = setup();
    prisma.turmaDeadline.findFirst.mockResolvedValue({ createdById: 'u1' });
    prisma.turmaDeadline.findUniqueOrThrow.mockResolvedValue({
      dueAt: new Date('2026-11-10T09:00:00Z'),
    });
    const dueAt = new Date('2026-11-12T09:00:00Z');
    prisma.turmaDeadline.update.mockResolvedValue({
      title: 'Midterm',
      subject: 'Redes',
      dueAt,
      weightPercentage: 40,
      tasks: [
        { taskId: 'k1', userId: 'u1' },
        { taskId: 'k2', userId: 'u2' },
      ],
    });

    await service.update('u1', 't1', 'd1', { dueAt: dueAt.toISOString() });

    const [args] = prisma.task.updateMany.mock.calls[0] as [
      { where: { id: { in: string[] } }; data: Record<string, unknown> },
    ];
    expect(args.where.id.in).toEqual(['k1', 'k2']);
    expect(args.data).toEqual({ title: 'Midterm', date: dueAt });
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith(
      'u2',
      'turmaDeadlineMoved',
      expect.any(Object),
    );
  });

  it('only who added it or the rep can edit', async () => {
    const { service, prisma } = setup();
    prisma.turmaDeadline.findFirst.mockResolvedValue({ createdById: 'other' });
    await expect(service.remove('u1', 't1', 'd1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const rep = setup(TurmaRole.DELEGADO);
    rep.prisma.turmaDeadline.findFirst.mockResolvedValue({
      createdById: 'other',
    });
    await rep.service.remove('u1', 't1', 'd1');
    expect(rep.prisma.turmaDeadline.delete).toHaveBeenCalled();
  });

  it('adds without weight when the subject is already at 100%', async () => {
    const { service, prisma, tasks } = setup();
    prisma.turmaDeadline.findFirst.mockResolvedValue({
      title: 'Midterm',
      dueAt: new Date('2026-11-12T09:00:00Z'),
      weightPercentage: 40,
      kind: 'FREQUENCIA',
      tasks: [],
    });
    tasks.create
      .mockRejectedValueOnce(new BadRequestException('over 100'))
      .mockResolvedValueOnce({ id: 'k9' });

    const result = await service.adopt('u1', 't1', 'd1', { areaId: 'a1' });

    expect(result).toEqual({ taskId: 'k9' });
    const [, second] = tasks.create.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    expect(second).not.toHaveProperty('weightPercentage');
    expect(prisma.turmaDeadlineTask.create).toHaveBeenCalledWith({
      data: { deadlineId: 'd1', userId: 'u1', taskId: 'k9' },
    });
  });
});
