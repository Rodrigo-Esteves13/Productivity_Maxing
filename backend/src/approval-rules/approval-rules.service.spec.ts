import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ApprovalRulesService,
  assertRulesConsistent,
  mergeRules,
  rulesToData,
} from './approval-rules.service';
import { presetRules, PRESET_GENERIC, PRESET_PT_PT_ISMAI } from './presets';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

const ME = 'me';
const PROGRAM = 'p-mine';
const OTHER_PROGRAM = 'p-other';
const AREA = 'a1';

const ismaiRow = (extra: Record<string, unknown> = {}) => ({
  ...presetRules(PRESET_PT_PT_ISMAI),
  ...extra,
});

function setup() {
  const prisma = {
    academicProgram: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    area: {
      findFirst: jest.fn().mockResolvedValue({ id: AREA }),
      findMany: jest.fn().mockResolvedValue([{ id: AREA }, { id: 'a2' }]),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    approvalRuleSet: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: unknown }) =>
          Promise.resolve(create),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    task: { findMany: jest.fn().mockResolvedValue([]) },
    gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ activeProgramId: null }),
    },
  };
  const service = new ApprovalRulesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('ApprovalRulesService ownership', () => {
  it('programa de outro user e 404 em get, put e delete', async () => {
    const { service, prisma } = setup();
    await expect(
      service.getForProgram(ME, OTHER_PROGRAM),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.upsertForProgram(ME, OTHER_PROGRAM, { passMark: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeForProgram(ME, OTHER_PROGRAM),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.academicProgram.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OTHER_PROGRAM, userId: ME } }),
    );
    expect(prisma.approvalRuleSet.upsert).not.toHaveBeenCalled();
    expect(prisma.approvalRuleSet.deleteMany).not.toHaveBeenCalled();
  });

  it('cadeira privada de outro user e 404', async () => {
    const { service, prisma } = setup();
    prisma.area.findFirst.mockResolvedValue(null);
    await expect(
      service.upsertForArea(ME, 'a-private', { passMark: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeForArea(ME, 'a-private')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.area.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'a-private',
          OR: [{ ownerId: null }, { ownerId: ME }],
        },
      }),
    );
    expect(prisma.approvalRuleSet.upsert).not.toHaveBeenCalled();
  });

  it('escritas e apagar ficam sempre presas ao userId', async () => {
    const { service, prisma } = setup();
    prisma.academicProgram.findFirst.mockResolvedValue({
      id: PROGRAM,
      gradeScale: '0-20',
    });
    await service.upsertForProgram(ME, PROGRAM, { presetKey: 'pt-PT-ismai' });
    const [args] = prisma.approvalRuleSet.upsert.mock.calls[0] as [
      { where: unknown; create: Record<string, unknown> },
    ];
    expect(args.where).toEqual({
      userId_programId: { userId: ME, programId: PROGRAM },
    });
    expect(args.create).toMatchObject({
      userId: ME,
      programId: PROGRAM,
      areaId: null,
      passMark: 10,
    });

    await service.removeForProgram(ME, PROGRAM);
    expect(prisma.approvalRuleSet.deleteMany).toHaveBeenCalledWith({
      where: { userId: ME, programId: PROGRAM },
    });
    await service.removeForArea(ME, AREA);
    expect(prisma.approvalRuleSet.deleteMany).toHaveBeenCalledWith({
      where: { userId: ME, areaId: AREA },
    });
  });

  it('override de cadeira grava so areaId', async () => {
    const { service, prisma } = setup();
    await service.upsertForArea(ME, AREA, { presetKey: 'pt-PT-ismai' });
    const [args] = prisma.approvalRuleSet.upsert.mock.calls[0] as [
      { where: unknown; create: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ userId_areaId: { userId: ME, areaId: AREA } });
    expect(args.create).toMatchObject({
      userId: ME,
      areaId: AREA,
      programId: null,
    });
  });
});

describe('ApprovalRulesService.resolveRulesForArea', () => {
  it('override da cadeira ganha ao programa', async () => {
    const { service, prisma } = setup();
    prisma.approvalRuleSet.findMany.mockResolvedValueOnce([
      ismaiRow({ areaId: AREA, passMark: 12 }),
    ]);
    const resolved = await service.resolveRulesForAreaWithSource(ME, AREA);
    expect(resolved.source).toBe('area');
    expect(resolved.rules.passMark).toBe(12);
    // Nem chega a procurar programas.
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('sem override usa as regras do programa da cadeira (via task/periodo)', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM } },
    ]);
    prisma.approvalRuleSet.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ismaiRow({ programId: PROGRAM })]);
    const resolved = await service.resolveRulesForAreaWithSource(ME, AREA);
    expect(resolved).toMatchObject({ source: 'program', programId: PROGRAM });
    expect(resolved.rules.presetKey).toBe(PRESET_PT_PT_ISMAI);
    const [taskArgs] = prisma.task.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(taskArgs.where).toMatchObject({
      userId: ME,
      period: { program: { userId: ME } },
    });
  });

  it('o programa vem tambem dos componentes de nota', async () => {
    const { service, prisma } = setup();
    prisma.gradeComponent.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM } },
    ]);
    prisma.approvalRuleSet.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ismaiRow({ programId: PROGRAM })]);
    const resolved = await service.resolveRulesForAreaWithSource(ME, AREA);
    expect(resolved.source).toBe('program');
  });

  it('com varios programas prefere o ativo', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ activeProgramId: 'p-active' });
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: 'p-recent' } },
      { areaId: AREA, period: { programId: 'p-active' } },
    ]);
    prisma.approvalRuleSet.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        ismaiRow({ programId: 'p-recent', passMark: 11 }),
        ismaiRow({ programId: 'p-active', passMark: 9 }),
      ]);
    const resolved = await service.resolveRulesForAreaWithSource(ME, AREA);
    expect(resolved.programId).toBe('p-active');
    expect(resolved.rules.passMark).toBe(9);
  });

  it('sem nada cai no generico na escala do programa', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM } },
    ]);
    prisma.academicProgram.findMany.mockResolvedValue([
      { id: PROGRAM, gradeScale: '0-100' },
    ]);
    const resolved = await service.resolveRulesForAreaWithSource(ME, AREA);
    expect(resolved.source).toBe('generic');
    expect(resolved.rules).toMatchObject({
      presetKey: PRESET_GENERIC,
      scaleMax: 100,
      passMark: 50,
    });
  });

  it('o generico segue o roundFinalGrade do programa', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM, roundFinalGrade: null } },
    ]);
    prisma.academicProgram.findMany.mockResolvedValue([
      { id: PROGRAM, gradeScale: '0-20', roundFinalGrade: true },
    ]);
    const rounded = await service.resolveRulesForArea(ME, AREA);
    expect(rounded.rounding).toBe('UP_TO_INTEGER_AT_HALF');

    prisma.academicProgram.findMany.mockResolvedValue([
      { id: PROGRAM, gradeScale: '0-20', roundFinalGrade: false },
    ]);
    const plain = await service.resolveRulesForArea(ME, AREA);
    expect(plain.rounding).toBe('NONE');
  });

  it('o roundFinalGrade do periodo sobrepoe-se ao do programa', async () => {
    const { service, prisma } = setup();
    prisma.academicProgram.findMany.mockResolvedValue([
      { id: PROGRAM, gradeScale: '0-20', roundFinalGrade: true },
    ]);
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM, roundFinalGrade: false } },
    ]);
    expect((await service.resolveRulesForArea(ME, AREA)).rounding).toBe('NONE');

    prisma.academicProgram.findMany.mockResolvedValue([
      { id: PROGRAM, gradeScale: '0-20', roundFinalGrade: false },
    ]);
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM, roundFinalGrade: true } },
    ]);
    expect((await service.resolveRulesForArea(ME, AREA)).rounding).toBe(
      'UP_TO_INTEGER_AT_HALF',
    );
  });

  it('o get do programa sem regras gravadas segue o roundFinalGrade', async () => {
    const { service, prisma } = setup();
    prisma.academicProgram.findFirst.mockResolvedValue({
      id: PROGRAM,
      gradeScale: '0-20',
      roundFinalGrade: true,
    });
    const view = await service.getForProgram(ME, PROGRAM);
    expect(view.source).toBe('generic');
    expect(view.rules.rounding).toBe('UP_TO_INTEGER_AT_HALF');
  });

  it('cadeira sem programa nenhum devolve o generico 0-20', async () => {
    const { service } = setup();
    const rules = await service.resolveRulesForArea(ME, AREA);
    expect(rules).toEqual(presetRules(PRESET_GENERIC));
  });

  it('todas as queries da resolucao filtram pelo user', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([
      { areaId: AREA, period: { programId: PROGRAM } },
    ]);
    await service.resolveRulesForArea(ME, AREA);
    for (const call of prisma.approvalRuleSet.findMany.mock.calls as [
      { where: { userId: string } },
    ][]) {
      expect(call[0].where.userId).toBe(ME);
    }
    const [programArgs] = prisma.academicProgram.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(programArgs.where.userId).toBe(ME);
  });
});

describe('mergeRules / assertRulesConsistent', () => {
  const generic = presetRules(PRESET_GENERIC);

  it('presetKey troca a base e os campos do body sobrepoem-se', () => {
    const rules = mergeRules(generic, {
      presetKey: 'pt-PT-ismai',
      componentMinGrade: null,
    });
    expect(rules.presetKey).toBe(PRESET_PT_PT_ISMAI);
    expect(rules.rounding).toBe('UP_TO_INTEGER_AT_HALF');
    expect(rules.componentMinGrade).toBeNull();
  });

  it('generico com escala nova move a nota de passagem', () => {
    expect(mergeRules(generic, { scaleMax: 100 }).passMark).toBe(50);
    expect(mergeRules(generic, { scaleMax: 100, passMark: 60 }).passMark).toBe(
      60,
    );
  });

  it('rejeita combinacoes incoerentes depois de juntar', () => {
    const ismai = presetRules(PRESET_PT_PT_ISMAI);
    expect(() =>
      assertRulesConsistent(mergeRules(ismai, { scaleMax: 5 })),
    ).toThrow(BadRequestException);
    expect(() =>
      assertRulesConsistent(mergeRules(ismai, { scaleMin: 30 })),
    ).toThrow(BadRequestException);
    expect(() =>
      assertRulesConsistent(mergeRules(ismai, { secondThreshold: null })),
    ).toThrow(BadRequestException);
    expect(() => assertRulesConsistent(ismai)).not.toThrow();
  });

  it('put com body incoerente nao grava', async () => {
    const { service, prisma } = setup();
    prisma.academicProgram.findFirst.mockResolvedValue({
      id: PROGRAM,
      gradeScale: '0-20',
    });
    await expect(
      service.upsertForProgram(ME, PROGRAM, { passMark: 25 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.approvalRuleSet.upsert).not.toHaveBeenCalled();
  });
});

describe('ApprovalRulesService.upsertForAllAreas', () => {
  it('grava o mesmo override em todas as cadeiras acessiveis, presas ao userId', async () => {
    const { service, prisma } = setup();
    const dto = { presetKey: PRESET_PT_PT_ISMAI } as never;
    await expect(service.upsertForAllAreas(ME, dto)).resolves.toEqual({
      count: 2,
    });
    expect(prisma.area.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ ownerId: null }, { ownerId: ME }] },
      }),
    );
    expect(prisma.approvalRuleSet.upsert).toHaveBeenCalledTimes(2);
    for (const areaId of [AREA, 'a2']) {
      expect(prisma.approvalRuleSet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_areaId: { userId: ME, areaId } },
          create: expect.objectContaining({
            userId: ME,
            areaId,
            programId: null,
            componentMinGrade: 6,
          }) as unknown,
        }),
      );
    }
  });

  it('body incoerente nao grava nada', async () => {
    const { service, prisma } = setup();
    await expect(
      service.upsertForAllAreas(ME, { scaleMin: 10, scaleMax: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.approvalRuleSet.upsert).not.toHaveBeenCalled();
  });
});

describe('customRules', () => {
  const rule = {
    kind: 'MAX_BELOW' as const,
    threshold: 8,
    maxBelow: 1,
    labelContains: 'teste',
  };

  it('mergeRules keeps base customRules when the body omits them', () => {
    const base = { ...presetRules(PRESET_GENERIC), customRules: [rule] };
    expect(mergeRules(base, { passMark: 10 }).customRules).toEqual([rule]);
  });

  it('mergeRules keeps base customRules when only presetKey is sent', () => {
    const base = { ...presetRules(PRESET_GENERIC), customRules: [rule] };
    const merged = mergeRules(base, { presetKey: PRESET_GENERIC });
    expect(merged.customRules).toEqual([rule]);
  });

  it('mergeRules replaces them, normalising absent optionals, and [] clears', () => {
    const base = { ...presetRules(PRESET_GENERIC), customRules: [rule] };
    const merged = mergeRules(base, {
      customRules: [{ kind: 'GROUP_AVG_MIN', threshold: 9, maxBelow: 4 }],
    });
    expect(merged.customRules).toEqual([
      {
        kind: 'GROUP_AVG_MIN',
        threshold: 9,
        maxBelow: null,
        labelContains: null,
      },
    ]);
    expect(mergeRules(base, { customRules: [] }).customRules).toEqual([]);
  });

  it('assertRulesConsistent rejects a threshold outside the scale', () => {
    const rules = {
      ...presetRules(PRESET_GENERIC),
      customRules: [{ ...rule, threshold: 99 }],
    };
    expect(() => assertRulesConsistent(rules)).toThrow(BadRequestException);
  });

  it('rulesToData maps empty customRules to DbNull', () => {
    const empty = rulesToData({
      ...presetRules(PRESET_GENERIC),
      customRules: [],
    });
    expect(empty.customRules).toBe(Prisma.DbNull);
    const filled = rulesToData({
      ...presetRules(PRESET_GENERIC),
      customRules: [rule],
    });
    expect(filled.customRules).toEqual([rule]);
  });

  it('bulk with areaIds restricts to accessible areas (foreign ids ignored)', async () => {
    const { service, prisma } = setup();
    prisma.area.findMany.mockResolvedValue([{ id: AREA }]);
    const res = await service.upsertForAllAreas(ME, {
      passMark: 10,
      areaIds: [AREA, 'foreign'],
    });
    expect(res).toEqual({ count: 1 });
    expect(prisma.area.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ ownerId: null }, { ownerId: ME }],
          id: { in: [AREA, 'foreign'] },
        },
      }),
    );
    expect(prisma.approvalRuleSet.upsert).toHaveBeenCalledTimes(1);
  });

  it('bulk without areaIds targets every accessible area', async () => {
    const { service, prisma } = setup();
    await service.upsertForAllAreas(ME, { passMark: 10 });
    const [args] = prisma.area.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).not.toHaveProperty('id');
    expect(prisma.approvalRuleSet.upsert).toHaveBeenCalledTimes(2);
  });
});
