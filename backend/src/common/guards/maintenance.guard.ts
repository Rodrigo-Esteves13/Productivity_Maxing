import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';

// Paths that must keep responding even during maintenance - Render's
// (and any external uptime monitor's) health check should never itself
// report the instance as down just because MAINTENANCE_MODE is set;
// that would turn a deliberate maintenance window into a false "the
// service crashed" alert.
const ALWAYS_ALLOWED_PATHS = new Set(['/health']);

/**
 * True while MAINTENANCE_MODE is set to a truthy value in the
 * environment. A plain env var rather than a DB flag or admin-only
 * endpoint on purpose - flipping it doesn't depend on the database (which
 * might be exactly what's being worked on) or on the app itself being up
 * to serve the toggle endpoint. Set it on Render, redeploy/restart, done;
 * unset it and restart again to come back up.
 */
export function isMaintenanceMode(): boolean {
  const value = process.env.MAINTENANCE_MODE;
  return value === 'true' || value === '1';
}

/**
 * Global guard (see app.module.ts) - when MAINTENANCE_MODE is on, every
 * request except the health check gets a 503 with a small JSON body the
 * frontend's axios interceptor (see api/apiClient.ts) recognizes and
 * turns into the full-page maintenance screen (MaintenancePage.tsx)
 * instead of a raw error toast.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isMaintenanceMode()) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (ALWAYS_ALLOWED_PATHS.has(req.path)) return true;

    throw new ServiceUnavailableException({
      code: 'MAINTENANCE_MODE',
      message: "Productivity Maxing is down for scheduled maintenance. We'll be back shortly.",
    });
  }
}
