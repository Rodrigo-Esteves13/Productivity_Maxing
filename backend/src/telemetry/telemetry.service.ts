import { Injectable, Logger } from '@nestjs/common';
import { ReportClientErrorDto } from './dto/report-client-error.dto';
import { ReportWebVitalDto } from './dto/report-web-vital.dto';

/**
 * Logs client-reported errors and Core Web Vitals as structured JSON
 * lines (via JsonLogger, wired globally in main.ts) rather than into a
 * new Prisma table. Render already aggregates stdout/stderr from every
 * instance, and NDJSON lines are directly queryable there (or by piping
 * to any log platform later) with zero extra infrastructure - a
 * dashboard/table can be layered on top later by shipping these same
 * logs somewhere queryable, without changing anything here.
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  reportClientError(dto: ReportClientErrorDto): void {
    // logger.error's second argument is the trace/stack - keeps this
    // consistent with how every other error in the app already logs,
    // and with JsonLogger's dedicated `trace` field.
    this.logger.error(
      `Client error: ${dto.message} (${dto.url})`,
      dto.stack ?? dto.componentStack,
      'ClientError',
    );
  }

  reportWebVital(dto: ReportWebVitalDto): void {
    this.logger.log(
      `${dto.name}=${dto.value} (${dto.url}, id=${dto.id})`,
      'WebVitals',
    );
  }
}
