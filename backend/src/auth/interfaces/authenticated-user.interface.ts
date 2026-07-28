import type { ApiKeyScope } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  // Only set when this request was authenticated via an API key (see
  // ApiKeyStrategy) - absent for a normal JWT/cookie session, which
  // always has full access to whatever the user's Role already permits.
  // ApiKeyScopeGuard reads this to gate admin-only routes when a request
  // came in via API key rather than a real session.
  apiKeyScope?: ApiKeyScope;
}
