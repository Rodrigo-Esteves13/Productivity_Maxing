import { Injectable, Logger } from '@nestjs/common';
import type { CommuteMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getGoogleMapsApiKey } from '../config/app.config';
import { MS_PER_DAY } from '../common/time.constants';
import { DistanceMatrixService } from './distance-matrix.service';

// Tempos guardados valem 60 dias (trajetos mudam pouco); depois volta a
// perguntar a Google na proxima vez que for preciso.
const TRAVEL_TIME_TTL_MS = 60 * MS_PER_DAY;
// Maximo de pedidos novos a Google por calculo de itinerario: limita custo e
// latencia (os restantes pares usam a estimativa por omissao e ficam para a
// proxima).
const MAX_LOOKUPS_PER_CALL = 10;

export interface TravelPair {
  origin: string;
  destination: string;
  mode: CommuteMode;
}

// Morada como chave: igual a mesma morada escrita com espacos/maiusculas
// diferentes.
export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function travelPairKey(pair: TravelPair): string {
  return `${pair.origin}|${pair.destination}|${pair.mode}`;
}

/**
 * Tempos de viagem entre moradas com cache na BD (TravelTime). Nunca lanca:
 * um par sem resposta fica de fora e o itinerario usa a estimativa por
 * omissao (a viagem casa-destino).
 */
@Injectable()
export class TravelTimesService {
  private readonly logger = new Logger(TravelTimesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly distanceMatrix: DistanceMatrixService,
  ) {}

  /**
   * Minutos de cada par pedido (chave travelPairKey). `allowLookups: false`
   * so usa a cache (ex: feed .ics publico, que nao deve gerar custos).
   */
  async resolve(
    userId: string,
    pairs: TravelPair[],
    options: { allowLookups?: boolean; now?: number } = {},
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const unique = new Map(pairs.map((p) => [travelPairKey(p), p]));
    if (unique.size === 0) return result;

    const now = options.now ?? Date.now();
    const freshAfter = new Date(now - TRAVEL_TIME_TTL_MS);
    const origins = [
      ...new Set(
        [...unique.values()].flatMap((p) => [p.origin, p.destination]),
      ),
    ];
    const cached = await this.prisma.travelTime.findMany({
      where: { userId, origin: { in: origins }, destination: { in: origins } },
      select: {
        origin: true,
        destination: true,
        mode: true,
        minutes: true,
        updatedAt: true,
      },
    });
    const fresh = new Map<string, number>();
    const stale = new Map<string, number>();
    for (const row of cached) {
      const key = travelPairKey(row);
      (row.updatedAt >= freshAfter ? fresh : stale).set(key, row.minutes);
    }

    const missing: TravelPair[] = [];
    for (const [key, pair] of unique) {
      // O sentido inverso serve se este ainda nao estiver guardado.
      const reverseKey = travelPairKey({
        origin: pair.destination,
        destination: pair.origin,
        mode: pair.mode,
      });
      const known = fresh.get(key) ?? fresh.get(reverseKey);
      if (known !== undefined) result.set(key, known);
      else missing.push(pair);
    }

    const canLookUp =
      (options.allowLookups ?? true) && getGoogleMapsApiKey() !== null;
    const toLookUp = canLookUp ? missing.slice(0, MAX_LOOKUPS_PER_CALL) : [];
    for (const pair of toLookUp) {
      const minutes = await this.lookUp(userId, pair);
      if (minutes !== null) result.set(travelPairKey(pair), minutes);
    }

    // O que ficou sem resposta nova usa um valor antigo, se houver.
    for (const pair of missing) {
      const key = travelPairKey(pair);
      if (result.has(key)) continue;
      const old = stale.get(key);
      if (old !== undefined) result.set(key, old);
    }
    return result;
  }

  private async lookUp(
    userId: string,
    pair: TravelPair,
  ): Promise<number | null> {
    try {
      const minutes = await this.distanceMatrix.getTravelMinutes(
        pair.origin,
        pair.destination,
        pair.mode,
      );
      await this.prisma.travelTime.upsert({
        where: {
          userId_origin_destination_mode: {
            userId,
            origin: pair.origin,
            destination: pair.destination,
            mode: pair.mode,
          },
        },
        create: { userId, ...pair, minutes },
        update: { minutes },
      });
      return minutes;
    } catch {
      // Detalhe ja registado pelo DistanceMatrixService; nunca a morada aqui.
      this.logger.warn('Travel time lookup failed for one address pair.');
      return null;
    }
  }
}
