import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';
import {
  buildStudyVsClass,
  type StudyVsClassResult,
} from './study-vs-class.util';
import {
  buildEctsWorkload,
  ECTS_MAX_RANGE_DAYS,
  ectsRangeDays,
  ectsStudyWindow,
  isRealDateKey,
  keepFinishedClasses,
  type EctsWorkloadResult,
} from './ects-workload.util';
import {
  getLisbonNow,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { EstimateCommuteDto } from './dto/estimate-commute.dto';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import { DistanceMatrixService } from '../maps/distance-matrix.service';
import {
  summarizeAttendance,
  type SubjectAttendance,
} from './attendance-summary.util';

// Mesmo raciocínio do IMPORT_CREATE_CONCURRENCY em tasks.service.ts: N
// upserts independentes, rápido o suficiente para não valer a pena uma
// fila/queue a sério, mas devagar o suficiente sequencialmente (um
// horário de semestre inteiro facilmente passa de 100 linhas) para
// beneficiar de correr em paralelo controlado.
const IMPORT_UPSERT_CONCURRENCY = 10;

export interface ImportScheduleRowResult {
  row: number;
  success: boolean;
  error?: string;
}

export interface ImportScheduleResult {
  imported: number;
  failed: number;
  // Aulas antigas no mesmo intervalo de datas que já não estão no ficheiro
  // (substituídas) e foram apagadas.
  removed: number;
  results: ImportScheduleRowResult[];
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly distanceMatrix: DistanceMatrixService,
  ) {}

  async importOccurrences(
    userId: string,
    dto: ImportScheduleDto,
  ): Promise<ImportScheduleResult> {
    const rows = dto.occurrences;

    const results = await runWithConcurrencyLimit(
      rows,
      IMPORT_UPSERT_CONCURRENCY,
      async (row, index): Promise<ImportScheduleRowResult> => {
        if (row.startMinutes >= row.endMinutes) {
          return {
            row: index + 1,
            success: false,
            error: 'startMinutes must be before endMinutes.',
          };
        }

        try {
          await this.prisma.classOccurrence.upsert({
            where: {
              userId_externalUid: { userId, externalUid: row.externalUid },
            },
            create: {
              userId,
              date: new Date(row.date),
              startMinutes: row.startMinutes,
              endMinutes: row.endMinutes,
              subject: row.subject,
              location: row.location,
              professor: row.professor,
              externalUid: row.externalUid,
            },
            // Reimportar atualiza tudo (a aula pode ter mudado de sala,
            // hora, ou até de disciplina se a faculdade reaproveitar o
            // mesmo UID entre semestres) - nunca só "criar se não existe".
            update: {
              date: new Date(row.date),
              startMinutes: row.startMinutes,
              endMinutes: row.endMinutes,
              subject: row.subject,
              location: row.location,
              professor: row.professor,
            },
          });
          return { row: index + 1, success: true };
        } catch (error) {
          this.logger.error(
            `Erro ao importar ocorrência (row ${index + 1})`,
            error as Error,
          );
          return {
            row: index + 1,
            success: false,
            error: 'Failed to save this row.',
          };
        }
      },
    );

    const removed = await this.removeStaleOccurrences(userId, rows);

    return {
      imported: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      removed,
      results,
    };
  }

  /**
   * Importar SUBSTITUI: dentro do intervalo de datas do ficheiro, apaga as
   * aulas que já lá estavam e que o ficheiro novo já não traz. Sem isto,
   * uma aula que muda de 3h para 4h (a faculdade muda o UID/horas do
   * evento) ficava duplicada: a antiga + a nova.
   *
   * Só apaga as que NÃO estão no ficheiro (por externalUid) - as que
   * continuam são atualizadas pelo upsert, mantendo o mesmo id (e assim a
   * ligação aos apontamentos do caderno, que é SetNull ao apagar).
   * Fora do intervalo do ficheiro nada é tocado: importar só novembro não
   * mexe em outubro.
   */
  private async removeStaleOccurrences(
    userId: string,
    rows: ImportScheduleDto['occurrences'],
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const times = rows
      .map((row) => new Date(row.date).getTime())
      .filter((t) => Number.isFinite(t));
    if (times.length === 0) return 0;

    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    to.setUTCHours(23, 59, 59, 999);

    const result = await this.prisma.classOccurrence.deleteMany({
      where: {
        userId,
        date: { gte: from, lte: to },
        externalUid: { notIn: rows.map((row) => row.externalUid) },
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Import substituiu o horário (user ${userId}): ${result.count} aulas antigas removidas`,
      );
    }
    return result.count;
  }

  /**
   * Ocorrências entre duas datas (inclusive), para a vista semanal e para
   * o StudyPlanService calcular os slots livres. `to` é sempre o fim do
   * dia - um pedido "de segunda a domingo" tem de incluir a última aula
   * de domingo, não parar à meia-noite desse dia.
   */
  async findRange(
    userId: string,
    from: Date,
    to: Date,
    // Aulas que nao houve (professor faltou) so interessam a grelha, que as
    // mostra riscadas; o plano de estudo e o Google Calendar ignoram-nas.
    { includeCancelled = false }: { includeCancelled?: boolean } = {},
  ) {
    const endOfTo = new Date(to);
    endOfTo.setHours(23, 59, 59, 999);

    return this.prisma.classOccurrence.findMany({
      where: {
        userId,
        date: { gte: from, lte: endOfTo },
        ...(!includeCancelled && { cancelled: false }),
      },
      orderBy: [{ date: 'asc' }, { startMinutes: 'asc' }],
    });
  }

  /**
   * Marca presença numa aula (true/false) ou limpa a marcação (null).
   * updateMany com { id, userId }: uma aula de outro user não bate e dá 404,
   * sem nunca revelar se o id existe.
   */
  async setAttendance(
    userId: string,
    id: string,
    attended: boolean | null,
  ): Promise<{ id: string; attended: boolean | null }> {
    const result = await this.prisma.classOccurrence.updateMany({
      where: { id, userId },
      data: { attended },
    });
    if (result.count === 0) throw new NotFoundException('Class not found.');
    return { id, attended };
  }

  /**
   * Aula que nao houve (professor faltou, desmarcada) ou que afinal houve.
   * A presenca fica guardada mas nao conta enquanto estiver cancelada (as
   * contagens filtram cancelled), e volta tal como estava se afinal houve.
   */
  async setCancelled(
    userId: string,
    id: string,
    cancelled: boolean,
  ): Promise<{ id: string; cancelled: boolean; attended: boolean | null }> {
    const result = await this.prisma.classOccurrence.updateMany({
      where: { id, userId },
      data: { cancelled },
    });
    if (result.count === 0) throw new NotFoundException('Class not found.');
    const row = await this.prisma.classOccurrence.findFirst({
      where: { id, userId },
      select: { attended: true },
    });
    return { id, cancelled, attended: row?.attended ?? null };
  }

  /**
   * Presenças por disciplina entre duas datas (inclusive). Só conta aulas
   * até ao fim de `upTo` (hoje, no controller): aulas futuras ainda não
   * podem ter presença e iam inflacionar o "por marcar".
   */
  async attendanceSummary(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<SubjectAttendance[]> {
    const endOfTo = new Date(to);
    endOfTo.setUTCHours(23, 59, 59, 999);
    const rows = await this.prisma.classOccurrence.groupBy({
      by: ['subject', 'attended'],
      // Aula desmarcada nao conta nem como presenca nem como falta.
      where: { userId, date: { gte: from, lte: endOfTo }, cancelled: false },
      _count: { _all: true },
    });
    return summarizeAttendance(rows);
  }

  /**
   * Horas de estudo por cadeira vs horas de aula dadas, entre duas datas
   * (inclusive). Aulas ligam-se a cadeira por AreaScheduleLink; sessoes de
   * estudo pelo areaId. Tudo filtrado pelo dono.
   */
  async studyVsClass(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<StudyVsClassResult> {
    const endOfTo = new Date(to);
    endOfTo.setUTCHours(23, 59, 59, 999);
    const [classes, sessions, links, areas] = await Promise.all([
      this.prisma.classOccurrence.findMany({
        where: { userId, date: { gte: from, lte: endOfTo }, cancelled: false },
        select: { subject: true, startMinutes: true, endMinutes: true },
      }),
      this.prisma.studySession.findMany({
        where: {
          userId,
          areaId: { not: null },
          startedAt: { gte: from, lte: endOfTo },
          endedAt: { not: null },
        },
        select: { areaId: true, startedAt: true, endedAt: true },
      }),
      this.prisma.areaScheduleLink.findMany({
        where: { userId },
        select: { scheduleSubject: true, areaId: true },
      }),
      this.prisma.area.findMany({
        where: accessibleAreaWhere(userId),
        select: { id: true, name: true, colorHex: true },
      }),
    ]);
    return buildStudyVsClass(
      classes,
      sessions,
      new Map(links.map((l) => [l.scheduleSubject, l.areaId])),
      areas,
    );
  }

  /**
   * Carga de trabalho por cadeira com creditos (ECTS): minutos de aula dados
   * (nao canceladas, presenca != false) e de estudo terminado entre duas
   * datas. `to` e cortado em hoje (hora de Lisboa): aulas futuras ainda nao
   * foram dadas. Tudo filtrado pelo dono.
   */
  async ectsWorkload(
    userId: string,
    fromKey: string,
    toKey: string,
    periodId?: string,
  ): Promise<EctsWorkloadResult> {
    if (!isRealDateKey(fromKey) || !isRealDateKey(toKey)) {
      throw new BadRequestException('Send "from" and "to" as YYYY-MM-DD.');
    }
    const { today, nowMinutes } = getLisbonNow();
    const todayKey = toDateKey(today);
    const effectiveToKey = toKey > todayKey ? todayKey : toKey;
    if (fromKey > effectiveToKey) return { courses: [], unlinkedSubjects: [] };
    if (ectsRangeDays(fromKey, effectiveToKey) > ECTS_MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `The range cannot exceed ${ECTS_MAX_RANGE_DAYS} days.`,
      );
    }

    // Periodo tem de ser do user (AcademicPeriod nao tem userId: via program).
    if (periodId) {
      const period = await this.prisma.academicPeriod.findFirst({
        where: { id: periodId, program: { userId } },
        select: { id: true },
      });
      if (!period) throw new NotFoundException('Period not found or no access.');
    }

    const window = ectsStudyWindow(fromKey, effectiveToKey);
    const [classRows, sessions, links, areas, hiddenRows, periodTasks] =
      await Promise.all([
        this.prisma.classOccurrence.findMany({
          where: {
            userId,
            date: {
              gte: parseDateKey(fromKey),
              lte: parseDateKey(effectiveToKey),
            },
            cancelled: false,
            OR: [{ attended: true }, { attended: null }],
          },
          select: {
            date: true,
            subject: true,
            startMinutes: true,
            endMinutes: true,
            cancelled: true,
            attended: true,
          },
        }),
        this.prisma.studySession.findMany({
          where: {
            userId,
            areaId: { not: null },
            endedAt: { not: null },
            startedAt: { gte: window.start, lt: window.end },
          },
          select: { areaId: true, startedAt: true, endedAt: true },
        }),
        this.prisma.areaScheduleLink.findMany({
          where: { userId },
          select: { scheduleSubject: true, areaId: true },
        }),
        this.prisma.area.findMany({
          where: {
            AND: [accessibleAreaWhere(userId), { credits: { gt: 0 } }],
          },
          select: { id: true, name: true, credits: true },
        }),
        this.prisma.areaHidden.findMany({
          where: { userId },
          select: { areaId: true },
        }),
        // Mesma regra de AreasService.findAll (usedInPeriod): a cadeira
        // pertence ao periodo se o user tem uma task nele.
        periodId
          ? this.prisma.task.findMany({
              where: { userId, periodId },
              select: { areaId: true },
              distinct: ['areaId'],
            })
          : Promise.resolve([] as Array<{ areaId: string }>),
      ]);

    const classes = keepFinishedClasses(
      classRows.map((row) => ({ ...row, dateKey: toDateKey(row.date) })),
      todayKey,
      nowMinutes,
    );
    const hidden = new Set(hiddenRows.map((h) => h.areaId));
    const periodAreaIds = new Set(periodTasks.map((t) => t.areaId));
    // Sem periodo: so cadeiras ligadas ao horario ou com estudo na janela.
    const activeAreaIds = new Set<string>([
      ...links.map((l) => l.areaId),
      ...sessions.flatMap((s) => (s.areaId ? [s.areaId] : [])),
    ]);
    const takenAreas = areas.filter(
      (area) =>
        !hidden.has(area.id) &&
        (periodId ? periodAreaIds : activeAreaIds).has(area.id),
    );

    return buildEctsWorkload(
      classes,
      sessions,
      new Map(links.map((l) => [l.scheduleSubject, l.areaId])),
      takenAreas,
      window,
    );
  }

  /**
   * Apaga aulas importadas do .ics do próprio utilizador. Sem `range`
   * apaga TODAS; com `range` só as que caem entre as duas datas (inclusive).
   * `where: { userId }` é sempre a primeira condição - nunca se apaga
   * nada de outra pessoa.
   *
   * Não toca em turnos/locais (WorkShift/Commitment), nem em ligações
   * disciplina->cadeira (AreaScheduleLink). Entradas do caderno criadas
   * numa aula NÃO são apagadas: NotebookEntry.classOccurrenceId é SetNull,
   * só perdem a ligação à aula.
   */
  async deleteOccurrences(
    userId: string,
    range?: { from: Date; to: Date },
  ): Promise<{ deleted: number }> {
    const where: {
      userId: string;
      date?: { gte: Date; lte: Date };
    } = { userId };

    if (range) {
      // Mesmo cuidado do findRange: `to` é o fim do dia.
      const endOfTo = new Date(range.to);
      endOfTo.setUTCHours(23, 59, 59, 999);
      where.date = { gte: range.from, lte: endOfTo };
    }

    const result = await this.prisma.classOccurrence.deleteMany({ where });
    this.logger.log(`Aulas apagadas (user ${userId}): ${result.count}`);
    return { deleted: result.count };
  }

  /**
   * Calcula o tempo de viagem casa-campus via Google Maps Distance Matrix e
   * grava homeAddress/campusAddress/commuteMinutes de uma vez no User. Sem
   * GOOGLE_MAPS_API_KEY o DistanceMatrixService devolve 503 e o frontend
   * deixa sempre o campo manual como caminho principal.
   */
  async estimateCommute(userId: string, dto: EstimateCommuteDto) {
    const commuteMinutes = await this.distanceMatrix.getTravelMinutes(
      dto.homeAddress,
      dto.campusAddress,
      dto.mode,
    );

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        homeAddress: dto.homeAddress,
        campusAddress: dto.campusAddress,
        commuteMinutes,
        commuteMode: dto.mode,
      },
      select: {
        homeAddress: true,
        campusAddress: true,
        commuteMinutes: true,
        commuteMode: true,
      },
    });
  }
}
