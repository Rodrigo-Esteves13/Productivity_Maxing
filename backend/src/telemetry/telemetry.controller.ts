import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TelemetryService } from './telemetry.service';
import { ReportClientErrorDto } from './dto/report-client-error.dto';
import { ReportWebVitalDto } from './dto/report-web-vital.dto';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';

/**
 * Deliberately unauthenticated (no JwtAuthGuard) - an ErrorBoundary crash
 * can happen before login even succeeds (or because auth itself broke),
 * and there's no user session to require here. That's also exactly why
 * both routes are throttled far tighter than the app's normal 100/min
 * default (see ThrottlerModule in app.module.ts): a public,
 * no-auth-required endpoint that writes to the log stream is an easy
 * target for log-flooding if left at the default limit.
 *
 * @SkipCsrf() on both: these are POSTs, and CsrfGuard would otherwise
 * enforce the CSRF check whenever the caller's browser happens to have an
 * access_token cookie (logged in elsewhere/another tab) - which produced
 * real 403s in practice, since web-vitals fires at app startup (main.tsx),
 * often before AuthContext's own /auth/csrf call has populated the
 * in-memory CSRF token these requests would need to send. These routes
 * don't use the session for anything regardless of whether that cookie
 * is present, so they're exempt outright rather than racing that timing.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('client-error')
  @HttpCode(204)
  @SkipCsrf()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  reportClientError(@Body() dto: ReportClientErrorDto): void {
    this.telemetryService.reportClientError(dto);
  }

  @Post('web-vitals')
  @HttpCode(204)
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  reportWebVital(@Body() dto: ReportWebVitalDto): void {
    this.telemetryService.reportWebVital(dto);
  }
}
