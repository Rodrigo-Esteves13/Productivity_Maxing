import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProgramsService } from './programs.service';
import { PeriodsService } from './periods.service';
import { CreateProgramDto } from './dto/create-program.dto';
import {
  MAX_PERIODS_PER_PROGRAM,
  MAX_PROGRAMS_PER_USER,
  MAX_PROGRAM_ORDER,
} from './academic-programs.constants';

const USER = 'user-1';
const PROGRAM = 'program-1';

describe('ProgramsService.create limit', () => {
  it('refuses a new program at the per-user cap', async () => {
    const prisma = {
      academicProgram: {
        count: jest.fn().mockResolvedValue(MAX_PROGRAMS_PER_USER),
        create: jest.fn(),
      },
    };
    const service = new ProgramsService(prisma as never);
    await expect(service.create(USER, { name: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.academicProgram.count).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    expect(prisma.academicProgram.create).not.toHaveBeenCalled();
  });

  it('creates below the cap', async () => {
    const prisma = {
      academicProgram: {
        count: jest.fn().mockResolvedValue(MAX_PROGRAMS_PER_USER - 1),
        create: jest.fn().mockResolvedValue({ id: PROGRAM }),
      },
    };
    const service = new ProgramsService(prisma as never);
    await service.create(USER, { name: 'X' });
    expect(prisma.academicProgram.create).toHaveBeenCalledTimes(1);
  });
});

describe('PeriodsService.create limit', () => {
  function build(count: number) {
    const prisma = {
      academicPeriod: {
        count: jest.fn().mockResolvedValue(count),
        create: jest.fn().mockResolvedValue({ id: 'p' }),
      },
    };
    const programs = { findOwnedOrThrow: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      service: new PeriodsService(prisma as never, programs as never),
    };
  }
  const dto = {
    programId: PROGRAM,
    name: 'S1',
    startDate: '2026-09-01T00:00:00Z',
  };

  it('refuses a new period at the per-program cap', async () => {
    const { service, prisma } = build(MAX_PERIODS_PER_PROGRAM);
    await expect(service.create(USER, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.academicPeriod.count).toHaveBeenCalledWith({
      where: { programId: PROGRAM },
    });
    expect(prisma.academicPeriod.create).not.toHaveBeenCalled();
  });

  it('creates below the cap', async () => {
    const { service, prisma } = build(MAX_PERIODS_PER_PROGRAM - 1);
    await service.create(USER, dto);
    expect(prisma.academicPeriod.create).toHaveBeenCalledTimes(1);
  });
});

describe('PeriodsService.resolveActivePeriodId at the program cap', () => {
  function build(options: {
    programs: number;
    latest?: Array<{ id: string; programId: string } | null>;
    periodCounts?: number[];
  }) {
    const findFirst = jest.fn();
    for (const row of options.latest ?? []) {
      findFirst.mockResolvedValueOnce(row);
    }
    const prisma = {
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ activePeriodId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      academicProgram: {
        count: jest.fn().mockResolvedValue(options.programs),
        create: jest.fn().mockResolvedValue({ id: 'new-program' }),
        findMany: jest.fn().mockResolvedValue(
          (options.periodCounts ?? []).map((periods, i) => ({
            id: `program-${i}`,
            _count: { periods },
          })),
        ),
      },
      academicPeriod: {
        findFirst,
        create: jest
          .fn()
          .mockResolvedValue({ id: 'new-period', programId: 'program-1' }),
      },
    };
    return {
      prisma,
      service: new PeriodsService(prisma as never, {} as never),
    };
  }

  it('creates "General" below the cap', async () => {
    const { service, prisma } = build({
      programs: MAX_PROGRAMS_PER_USER - 1,
    });
    await expect(service.resolveActivePeriodId(USER)).resolves.toBe(
      'new-period',
    );
    expect(prisma.academicProgram.create).toHaveBeenCalledTimes(1);
  });

  it('reuses the latest active period, scoped to the user', async () => {
    const { service, prisma } = build({
      programs: MAX_PROGRAMS_PER_USER,
      latest: [{ id: 'old', programId: PROGRAM }],
    });
    await expect(service.resolveActivePeriodId(USER)).resolves.toBe('old');
    expect(prisma.academicPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { program: { userId: USER }, isArchived: false },
      }),
    );
    expect(prisma.academicProgram.create).not.toHaveBeenCalled();
    expect(prisma.academicPeriod.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { activeProgramId: PROGRAM, activePeriodId: 'old' },
    });
  });

  it('adds a period to a program with room when none is active', async () => {
    const { service, prisma } = build({
      programs: MAX_PROGRAMS_PER_USER,
      latest: [null],
      periodCounts: [MAX_PERIODS_PER_PROGRAM, 0],
    });
    await expect(service.resolveActivePeriodId(USER)).resolves.toBe(
      'new-period',
    );
    const [args] = prisma.academicPeriod.create.mock.calls[0] as [
      { data: { programId: string } },
    ];
    expect(args.data.programId).toBe('program-1');
    expect(prisma.academicProgram.create).not.toHaveBeenCalled();
  });

  it('falls back to an archived period when every program is full', async () => {
    const { service, prisma } = build({
      programs: MAX_PROGRAMS_PER_USER,
      latest: [null, { id: 'archived', programId: PROGRAM }],
      periodCounts: [MAX_PERIODS_PER_PROGRAM],
    });
    await expect(service.resolveActivePeriodId(USER)).resolves.toBe('archived');
    expect(prisma.academicPeriod.create).not.toHaveBeenCalled();
  });
});

describe('CreateProgramDto order cap', () => {
  const check = (order: number) =>
    validate(plainToInstance(CreateProgramDto, { name: 'X', order }));

  it('accepts the cap and rejects above it', async () => {
    expect(await check(MAX_PROGRAM_ORDER)).toHaveLength(0);
    expect(await check(MAX_PROGRAM_ORDER + 1)).toHaveLength(1);
  });
});
