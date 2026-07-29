import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyScope } from '@prisma/client';
import { REQUIRE_API_KEY_SCOPE_KEY } from '../decorators/require-api-key-scope.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

// Runs alongside RolesGuard on admin routes, not instead of it.
// RolesGuard already checks "is this USER an admin" - this guard adds a
// second, narrower check: "if they got in via an API key, is THAT KEY
// allowed to do admin things". A leaked TASKS-scoped key (e.g. the one
// embedded, base64-only, in the pmaxing-agent .exe) categorically cannot
// pass this guard, no matter what Role the underlying user has.
@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<ApiKeyScope>(
      REQUIRE_API_KEY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) return true; // route doesn't opt into this check

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // No apiKeyScope on req.user means this request authenticated via a
    // normal JWT/cookie session (see JwtStrategy), not an API key - a
    // real session is never restricted by key scope, only by Role
    // (already checked separately by RolesGuard).
    if (!user || user.apiKeyScope === undefined) return true;

    if (user.apiKeyScope !== requiredScope) {
      throw new ForbiddenException(
        `This action requires an API key with "${requiredScope}" scope.`,
      );
    }
    return true;
  }
}
