import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '@prisma/client';

export const REQUIRE_API_KEY_SCOPE_KEY = 'requireApiKeyScope';

// Marks a route as needing at least this API key scope WHEN the request
// came in via API key. A real JWT/cookie session is unaffected by this -
// see ApiKeyScopeGuard for why. Pair with @Roles(Role.ADMIN) + RolesGuard
// on admin routes: RolesGuard checks the user's actual Role, this guard
// additionally checks the KEY's scope if that's how they authenticated -
// both must pass.
export const RequireApiKeyScope = (scope: ApiKeyScope) =>
  SetMetadata(REQUIRE_API_KEY_SCOPE_KEY, scope);
