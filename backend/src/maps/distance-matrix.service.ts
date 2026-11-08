import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CommuteMode } from '@prisma/client';
import { getGoogleMapsApiKey } from '../config/app.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../common/circuit-breaker.util';
import {
  MAPS_BREAKER_FAILURE_THRESHOLD,
  MAPS_BREAKER_OPEN_MS,
  MAPS_TIMEOUT_MS,
} from '../common/http-resilience.constants';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../common/time.constants';

const SECONDS_PER_MINUTE = MS_PER_MINUTE / MS_PER_SECOND;
const DISTANCE_MATRIX_URL =
  'https://maps.googleapis.com/maps/api/distancematrix/json';
const MAPS_CLIENT_NAME = 'Distance Matrix';

// Estados que dizem que o servico (ou a key/quota) esta em baixo, e nao que
// as moradas estao mal: so estes contam para abrir o circuito.
const SERVICE_FAILURE_STATUSES = new Set([
  'OVER_QUERY_LIMIT',
  'OVER_DAILY_LIMIT',
  'REQUEST_DENIED',
  'UNKNOWN_ERROR',
]);

// Só os campos que realmente lemos da resposta.
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

/**
 * Único sítio que fala com a Google Distance Matrix API. Usado pelo
 * commute casa-campus (ScheduleService) e pelo commute casa-local de
 * trabalho/evento (CommitmentsService).
 */
@Injectable()
export class DistanceMatrixService {
  private readonly logger = new Logger(DistanceMatrixService.name);
  // Com a Google em baixo (ou quota esgotada) deixa de tentar durante um
  // bocado: o itinerario usa a estimativa por omissao e o commute devolve
  // 503, que o frontend ja trata como "preenche a mao".
  private readonly breaker = new CircuitBreaker({
    name: MAPS_CLIENT_NAME,
    failureThreshold: MAPS_BREAKER_FAILURE_THRESHOLD,
    openDurationMs: MAPS_BREAKER_OPEN_MS,
  });

  /** Minutos de viagem (um sentido) entre duas moradas. */
  async getTravelMinutes(
    origin: string,
    destination: string,
    mode: CommuteMode,
  ): Promise<number> {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Automatic commute estimation is not configured on this server. Set commuteMinutes manually instead.',
      );
    }

    const url = new URL(DISTANCE_MATRIX_URL);
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    // Google usa os modos em minúsculas; o enum do Prisma está em maiúsculas.
    url.searchParams.set('mode', mode.toLowerCase());
    url.searchParams.set('key', apiKey);

    let payload: DistanceMatrixResponse;
    try {
      payload = await this.breaker.execute(
        async () => {
          const res = await fetch(url.toString(), {
            signal: AbortSignal.timeout(MAPS_TIMEOUT_MS),
          });
          return (await res.json()) as DistanceMatrixResponse;
        },
        { isFailureResult: (p) => SERVICE_FAILURE_STATUSES.has(p.status) },
      );
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new ServiceUnavailableException(
          'The maps service is temporarily unavailable. Try again later, or set the commute time manually.',
        );
      }
      // So a mensagem: o URL tem a key e nunca vai para o log.
      this.logger.error(
        `Falha ao contactar a Distance Matrix API: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
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
      // O detalhe (key inválida, quota, ZERO_RESULTS...) fica só no log do
      // servidor: nunca vai para o cliente para não vazar info sobre a key.
      this.logger.warn(
        `Distance Matrix devolveu um erro: payload.status=${payload.status}` +
          (payload.error_message
            ? `, error_message="${payload.error_message}"`
            : '') +
          (element
            ? `, element.status=${element.status}`
            : ', sem elemento na resposta'),
      );
      throw new BadRequestException(
        "Couldn't calculate a route between those two addresses. Check them and try again, or set the commute time manually.",
      );
    }

    return Math.round(element.duration.value / SECONDS_PER_MINUTE);
  }
}
