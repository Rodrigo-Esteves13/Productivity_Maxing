import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { EstimateCommuteDto } from './dto/estimate-commute.dto';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import { DistanceMatrixService } from '../maps/distance-matrix.service';

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
  async findRange(userId: string, from: Date, to: Date) {
    const endOfTo = new Date(to);
    endOfTo.setHours(23, 59, 59, 999);

    return this.prisma.classOccurrence.findMany({
      where: { userId, date: { gte: from, lte: endOfTo } },
      orderBy: [{ date: 'asc' }, { startMinutes: 'asc' }],
    });
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
