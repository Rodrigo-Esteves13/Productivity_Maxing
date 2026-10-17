import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CommuteMode } from '@prisma/client';
import { getGoogleMapsApiKey } from '../config/app.config';

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

    const url = new URL(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
    );
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    // Google usa os modos em minúsculas; o enum do Prisma está em maiúsculas.
    url.searchParams.set('mode', mode.toLowerCase());
    url.searchParams.set('key', apiKey);

    let payload: DistanceMatrixResponse;
    try {
      const res = await fetch(url.toString());
      payload = (await res.json()) as DistanceMatrixResponse;
    } catch (error) {
      this.logger.error(
        'Falha ao contactar a Distance Matrix API',
        error as Error,
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

    return Math.round(element.duration.value / 60);
  }
}
