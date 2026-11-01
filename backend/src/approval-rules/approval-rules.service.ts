import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApprovalRuleSet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  accessibleAreaWhere,
  assertAreaAccessible,
} from '../areas/area-access';
import {
  parseGradeScale,
  resolveRoundFinalGrade,
} from '../academic-programs/grade-average.util';
import type { ApprovalRules } from './approval-rules.types';
import {
  APPROVAL_PRESETS,
  APPROVAL_PRESET_KEYS,
  PRESET_GENERIC,
  genericRulesForScale,
  presetRules,
} from './presets';
import type { ApprovalPresetKey } from './presets';
import { UpsertApprovalRulesDto } from './dto/upsert-approval-rules.dto';

/** De onde vieram as regras efetivas de uma cadeira. */
export type ApprovalRulesSource = 'area' | 'program' | 'generic';
export type ApprovalRulesScope = 'program' | 'area';

export interface ResolvedApprovalRules {
  rules: ApprovalRules;
  source: ApprovalRulesSource;
  /** Programa usado na resolucao (null se nao se encontrou nenhum). */
  programId: string | null;
}

export interface ApprovalRulesView {
  scope: ApprovalRulesScope;
  targetId: string;
  /** true se o user gravou regras para este programa/cadeira. */
  isCustom: boolean;
  source: ApprovalRulesSource;
  rules: ApprovalRules;
}

export interface ApprovalPresetView {
  key: ApprovalPresetKey;
  rules: ApprovalRules;
}

type RuleRow = Pick<
  ApprovalRuleSet,
  | 'presetKey'
  | 'scaleMin'
  | 'scaleMax'
  | 'passMark'
  | 'rounding'
  | 'componentMinGrade'
  | 'secondThreshold'
  | 'maxBelowSecondThreshold'
  | 'hasExamTrack'
  | 'hasResitTrack'
>;

export function rowToRules(row: RuleRow): ApprovalRules {
  return {
    presetKey: row.presetKey,
    scaleMin: row.scaleMin,
    scaleMax: row.scaleMax,
    passMark: row.passMark,
    rounding: row.rounding,
    componentMinGrade: row.componentMinGrade,
    secondThreshold: row.secondThreshold,
    maxBelowSecondThreshold: row.maxBelowSecondThreshold,
    hasExamTrack: row.hasExamTrack,
    hasResitTrack: row.hasResitTrack,
  };
}

function genericForGradeScale(
  gradeScale: string | null | undefined,
  roundFinalGrade: boolean,
) {
  const { min, max } = parseGradeScale(gradeScale ?? '');
  return genericRulesForScale(min, max, roundFinalGrade);
}

const isInScale = (value: number, rules: ApprovalRules) =>
  value >= rules.scaleMin && value <= rules.scaleMax;

/**
 * Validacao final, depois de juntar body + base. O DTO so consegue comparar
 * campos que vieram juntos no mesmo body.
 */
export function assertRulesConsistent(rules: ApprovalRules): void {
  if (!(rules.scaleMax > rules.scaleMin)) {
    throw new BadRequestException('scaleMax must be greater than scaleMin.');
  }
  const scaled: [string, number | null][] = [
    ['passMark', rules.passMark],
    ['componentMinGrade', rules.componentMinGrade],
    ['secondThreshold', rules.secondThreshold],
  ];
  for (const [field, value] of scaled) {
    if (value !== null && !isInScale(value, rules)) {
      throw new BadRequestException(`${field} must be within the grade scale.`);
    }
  }
  if (
    rules.maxBelowSecondThreshold !== null &&
    rules.secondThreshold === null
  ) {
    throw new BadRequestException(
      'maxBelowSecondThreshold needs a secondThreshold.',
    );
  }
}

/**
 * Junta o body com a base. presetKey no body troca a base pelo preset; o
 * resto dos campos do body sobrepoe-se. Se a base for o preset generico e a
 * escala mudar, a nota de passagem acompanha a escala (salvo passMark
 * explicito no body).
 */
export function mergeRules(
  base: ApprovalRules,
  dto: UpsertApprovalRulesDto,
): ApprovalRules {
  let start: ApprovalRules = dto.presetKey
    ? presetRules(dto.presetKey)
    : { ...base };
  const scaleMin = dto.scaleMin ?? start.scaleMin;
  const scaleMax = dto.scaleMax ?? start.scaleMax;
  const scaleChanged =
    scaleMin !== start.scaleMin || scaleMax !== start.scaleMax;
  if (start.presetKey === PRESET_GENERIC && scaleChanged) {
    start = {
      ...start,
      passMark: genericRulesForScale(scaleMin, scaleMax).passMark,
    };
  }
  const pick = <K extends keyof ApprovalRules>(key: K): ApprovalRules[K] =>
    dto[key] === undefined ? start[key] : (dto[key] as ApprovalRules[K]);

  return {
    presetKey: dto.presetKey === undefined ? start.presetKey : dto.presetKey,
    scaleMin,
    scaleMax,
    passMark: pick('passMark'),
    rounding: pick('rounding'),
    componentMinGrade: pick('componentMinGrade'),
    secondThreshold: pick('secondThreshold'),
    maxBelowSecondThreshold: pick('maxBelowSecondThreshold'),
    hasExamTrack: pick('hasExamTrack'),
    hasResitTrack: pick('hasResitTrack'),
  };
}

const RULE_SELECT = {
  presetKey: true,
  scaleMin: true,
  scaleMax: true,
  passMark: true,
  rounding: true,
  componentMinGrade: true,
  secondThreshold: true,
  maxBelowSecondThreshold: true,
  hasExamTrack: true,
  hasResitTrack: true,
} as const;

const PERIOD_RULE_SELECT = { programId: true, roundFinalGrade: true } as const;

@Injectable()
export class ApprovalRulesService {
  constructor(private readonly prisma: PrismaService) {}

  listPresets(): ApprovalPresetView[] {
    return APPROVAL_PRESET_KEYS.map((key) => ({
      key,
      rules: { ...APPROVAL_PRESETS[key] },
    }));
  }

  // ---- Programa ----

  private async findOwnedProgramOrThrow(userId: string, programId: string) {
    const program = await this.prisma.academicProgram.findFirst({
      where: { id: programId, userId },
      select: { id: true, gradeScale: true, roundFinalGrade: true },
    });
    if (!program) throw new NotFoundException('Program not found.');
    return program;
  }

  private findProgramRuleSet(userId: string, programId: string) {
    return this.prisma.approvalRuleSet.findFirst({
      where: { userId, programId },
      select: RULE_SELECT,
    });
  }

  async getForProgram(
    userId: string,
    programId: string,
  ): Promise<ApprovalRulesView> {
    const program = await this.findOwnedProgramOrThrow(userId, programId);
    const row = await this.findProgramRuleSet(userId, programId);
    return {
      scope: 'program',
      targetId: programId,
      isCustom: Boolean(row),
      source: row ? 'program' : 'generic',
      rules: row
        ? rowToRules(row)
        : genericForGradeScale(program.gradeScale, program.roundFinalGrade),
    };
  }

  async upsertForProgram(
    userId: string,
    programId: string,
    dto: UpsertApprovalRulesDto,
  ): Promise<ApprovalRulesView> {
    const program = await this.findOwnedProgramOrThrow(userId, programId);
    const row = await this.findProgramRuleSet(userId, programId);
    const base = row
      ? rowToRules(row)
      : genericForGradeScale(program.gradeScale, program.roundFinalGrade);
    const rules = mergeRules(base, dto);
    assertRulesConsistent(rules);

    const saved = await this.prisma.approvalRuleSet.upsert({
      where: { userId_programId: { userId, programId } },
      create: { userId, programId, areaId: null, ...rules },
      update: { ...rules },
      select: RULE_SELECT,
    });
    return {
      scope: 'program',
      targetId: programId,
      isCustom: true,
      source: 'program',
      rules: rowToRules(saved),
    };
  }

  async removeForProgram(userId: string, programId: string): Promise<void> {
    await this.findOwnedProgramOrThrow(userId, programId);
    await this.prisma.approvalRuleSet.deleteMany({
      where: { userId, programId },
    });
  }

  // ---- Cadeira (override) ----

  async getForArea(userId: string, areaId: string): Promise<ApprovalRulesView> {
    await assertAreaAccessible(this.prisma, userId, areaId);
    const resolved = await this.resolveRulesForAreaWithSource(userId, areaId);
    return {
      scope: 'area',
      targetId: areaId,
      isCustom: resolved.source === 'area',
      source: resolved.source,
      rules: resolved.rules,
    };
  }

  async upsertForArea(
    userId: string,
    areaId: string,
    dto: UpsertApprovalRulesDto,
  ): Promise<ApprovalRulesView> {
    await assertAreaAccessible(this.prisma, userId, areaId);
    // Sem override ainda, parte das regras efetivas (as do programa), para
    // mudar um so campo nao reiniciar o resto.
    const { rules: base } = await this.resolveRulesForAreaWithSource(
      userId,
      areaId,
    );
    const rules = mergeRules(base, dto);
    assertRulesConsistent(rules);

    const saved = await this.prisma.approvalRuleSet.upsert({
      where: { userId_areaId: { userId, areaId } },
      create: { userId, areaId, programId: null, ...rules },
      update: { ...rules },
      select: RULE_SELECT,
    });
    return {
      scope: 'area',
      targetId: areaId,
      isCustom: true,
      source: 'area',
      rules: rowToRules(saved),
    };
  }

  /**
   * Grava as mesmas regras como override em todas as cadeiras acessiveis do
   * user (as proprias e as globais), de uma vez. So escreve linhas do user.
   */
  async upsertForAllAreas(
    userId: string,
    dto: UpsertApprovalRulesDto,
  ): Promise<{ count: number }> {
    const rules = mergeRules(presetRules(PRESET_GENERIC), dto);
    assertRulesConsistent(rules);

    const areas = await this.prisma.area.findMany({
      where: accessibleAreaWhere(userId),
      select: { id: true },
    });
    await this.prisma.$transaction(
      areas.map(({ id: areaId }) =>
        this.prisma.approvalRuleSet.upsert({
          where: { userId_areaId: { userId, areaId } },
          create: { userId, areaId, programId: null, ...rules },
          update: { ...rules },
          select: { id: true },
        }),
      ),
    );
    return { count: areas.length };
  }

  async removeForArea(userId: string, areaId: string): Promise<void> {
    await assertAreaAccessible(this.prisma, userId, areaId);
    await this.prisma.approvalRuleSet.deleteMany({
      where: { userId, areaId },
    });
  }

  // ---- Resolucao (contrato N45-N47) ----

  /** override da cadeira > regras do programa > preset generico. */
  async resolveRulesForArea(
    userId: string,
    areaId: string,
  ): Promise<ApprovalRules> {
    return (await this.resolveRulesForAreaWithSource(userId, areaId)).rules;
  }

  async resolveRulesForAreaWithSource(
    userId: string,
    areaId: string,
  ): Promise<ResolvedApprovalRules> {
    const map = await this.resolveRulesForAreas(userId, [areaId]);
    return map.get(areaId) as ResolvedApprovalRules;
  }

  /**
   * Versao em lote (o endpoint de risco resolve todas as cadeiras de uma
   * vez). A Area e global, por isso o programa vem das Tasks do user nessa
   * cadeira (Task.periodId -> period.programId) e dos GradeComponents
   * (periodId). Com varios programas candidatos: o ativo primeiro, depois o
   * da task mais recente; ganha o primeiro que tenha regras gravadas.
   */
  async resolveRulesForAreas(
    userId: string,
    areaIds: string[],
  ): Promise<Map<string, ResolvedApprovalRules>> {
    const result = new Map<string, ResolvedApprovalRules>();
    const uniqueIds = [...new Set(areaIds)];
    if (uniqueIds.length === 0) return result;

    const overrides = await this.prisma.approvalRuleSet.findMany({
      where: { userId, areaId: { in: uniqueIds } },
      select: { ...RULE_SELECT, areaId: true },
    });
    for (const row of overrides) {
      if (!row.areaId) continue;
      result.set(row.areaId, {
        rules: rowToRules(row),
        source: 'area',
        programId: null,
      });
    }

    const pending = uniqueIds.filter((id) => !result.has(id));
    if (pending.length === 0) return result;

    const candidates = await this.loadProgramCandidates(userId, pending);
    const allProgramIds = [
      ...new Set([...candidates.programIds.values()].flat()),
    ];

    const [programRules, programs] = allProgramIds.length
      ? await Promise.all([
          this.prisma.approvalRuleSet.findMany({
            where: { userId, programId: { in: allProgramIds } },
            select: { ...RULE_SELECT, programId: true },
          }),
          this.prisma.academicProgram.findMany({
            where: { userId, id: { in: allProgramIds } },
            select: { id: true, gradeScale: true, roundFinalGrade: true },
          }),
        ])
      : [[], []];

    const rulesByProgram = new Map(
      programRules
        .filter((row) => row.programId)
        .map((row) => [row.programId as string, rowToRules(row)]),
    );
    const programById = new Map(programs.map((p) => [p.id, p]));

    for (const areaId of pending) {
      const ordered = candidates.programIds.get(areaId) ?? [];
      const withRules = ordered.find((id) => rulesByProgram.has(id));
      if (withRules) {
        result.set(areaId, {
          rules: { ...(rulesByProgram.get(withRules) as ApprovalRules) },
          source: 'program',
          programId: withRules,
        });
        continue;
      }
      const preferred = ordered[0] ?? null;
      const program = preferred ? programById.get(preferred) : undefined;
      // O periodo (mais recente) da cadeira pode sobrepor o do programa.
      const periodOverride = preferred
        ? candidates.periodRounding.get(`${areaId}|${preferred}`)
        : undefined;
      result.set(areaId, {
        rules: genericForGradeScale(
          program?.gradeScale,
          resolveRoundFinalGrade(
            program?.roundFinalGrade ?? false,
            periodOverride,
          ),
        ),
        source: 'generic',
        programId: preferred,
      });
    }
    return result;
  }

  /**
   * programIds candidatos por areaId (por ordem de preferencia) e, por
   * "areaId|programId", o roundFinalGrade do periodo mais recente (null se
   * herda do programa).
   */
  private async loadProgramCandidates(
    userId: string,
    areaIds: string[],
  ): Promise<{
    programIds: Map<string, string[]>;
    periodRounding: Map<string, boolean | null>;
  }> {
    const ownedPeriod = { program: { userId } };
    const [user, tasks, components] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { activeProgramId: true },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          areaId: { in: areaIds },
          periodId: { not: null },
          period: ownedPeriod,
        },
        select: { areaId: true, period: { select: PERIOD_RULE_SELECT } },
        distinct: ['areaId', 'periodId'],
        orderBy: { date: 'desc' },
      }),
      this.prisma.gradeComponent.findMany({
        where: { userId, areaId: { in: areaIds }, period: ownedPeriod },
        select: { areaId: true, period: { select: PERIOD_RULE_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const map = new Map<string, string[]>();
    const periodRounding = new Map<string, boolean | null>();
    for (const row of [...tasks, ...components]) {
      const programId = row.period?.programId;
      if (!programId) continue;
      const roundingKey = `${row.areaId}|${programId}`;
      if (!periodRounding.has(roundingKey)) {
        periodRounding.set(roundingKey, row.period?.roundFinalGrade ?? null);
      }
      const list = map.get(row.areaId) ?? [];
      if (!list.includes(programId)) list.push(programId);
      map.set(row.areaId, list);
    }

    const activeProgramId = user?.activeProgramId ?? null;
    if (activeProgramId) {
      for (const [areaId, list] of map) {
        if (list.includes(activeProgramId)) {
          map.set(areaId, [
            activeProgramId,
            ...list.filter((id) => id !== activeProgramId),
          ]);
        }
      }
    }
    return { programIds: map, periodRounding };
  }
}
