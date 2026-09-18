import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { EstimateCommuteDto } from './dto/estimate-commute.dto';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import { getGoogleMapsApiKey } from '../config/app.config';

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
  results: ImportScheduleRowResult[];
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return {
      imported: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
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
   * Calcula o tempo de viagem casa-campus via Google Maps Distance Matrix
   * (modo "driving" - é o único trajeto que interessa aqui, sempre o
   * mesmo par de moradas) e grava homeAddress/campusAddress/
   * commuteMinutes de uma vez no User. Sem GOOGLE_MAPS_API_KEY
   * configurada, este endpoint nem chega a ser chamado com sucesso -
   * ScheduleController devolve 503 antes de tentar, e o frontend esconde
   * o botão "Calculate automatically" (ver CommuteSettingsCard.tsx),
   * deixando sempre o campo manual como caminho principal.
   */
  async estimateCommute(userId: string, dto: EstimateCommuteDto) {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Automatic commute estimation is not configured on this server. Set commuteMinutes manually instead.',
      );
    }

    const url = new URL(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
    );
    url.searchParams.set('origins', dto.homeAddress);
    url.searchParams.set('destinations', dto.campusAddress);
    // Google usa os valores do modo em minúsculas (driving/walking/
    // bicycling/transit) - o enum do Prisma está em maiúsculas só por
    // convenção do schema, daí o .toLowerCase() aqui.
    url.searchParams.set('mode', dto.mode.toLowerCase());
    url.searchParams.set('key', apiKey);

    let payload: DistanceMatrixResponse;
    try {
      const res = await fetch(url.toString());
      payload = (await res.json()) as DistanceMatrixResponse;
    } catch (error) {
      this.logger.error('Falha ao contactar a Distance Matrix API', error as Error);
      throw new InternalServerErrorException(
        'Could not reach the maps service. Try again later.',
      );
    }

    const element = payload.rows?.[0]?.elements?.[0];
    if (
      payload.status !== 'OK' ||
      !element ||
      element.status !== 'OK' ||
      !element.duration
    ) {
      // O status "top-level" (payload.status) cobre problemas com o
      // pedido inteiro (key inválida/restrita, API não ativada, billing
      // por propagar, quota) - normalmente REQUEST_DENIED ou
      // INVALID_REQUEST, e vem com error_message a explicar exatamente
      // qual. O status "per-element" (element.status) cobre problemas
      // com o par de moradas em si (ex: ZERO_RESULTS = sem rota de
      // carro entre as duas). Nunca mostramos isto ao frontend (podia
      // vazar detalhes da própria key), mas fica sempre no log do
      // servidor - é o primeiro sítio a olhar quando isto falha.
      this.logger.warn(
        `Distance Matrix devolveu um erro: payload.status=${payload.status}` +
          (payload.error_message ? `, error_message="${payload.error_message}"` : '') +
          (element ? `, element.status=${element.status}` : ', sem elemento na resposta'),
      );
      throw new BadRequestException(
        "Couldn't calculate a route between those two addresses. Check them and try again, or set the commute time manually.",
      );
    }

    const commuteMinutes = Math.round(element.duration.value / 60);

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

// Só os campos que realmente lemos da resposta - a API devolve muito mais
// (endereços "corrigidos", distância em texto/metros, etc.) que não
// precisamos de tipar aqui.
interface DistanceMatrixResponse {
  status: string;
  error_message?: string;
  rows?: {
    elements?: {
      status: string;
      duration?: { value: number; text: string };
    }[];
  }[];
}
