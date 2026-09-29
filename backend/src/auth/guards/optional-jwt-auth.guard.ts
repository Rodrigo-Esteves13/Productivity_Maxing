import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Same 'jwt' strategy as JwtAuthGuard, but never rejects the request for
// a missing/invalid/expired token - it just means the caller is
// anonymous, not that the request is malformed. Used only on the shared
// notebook entry endpoint (see NotebookShareController), which has to
// stay reachable with no session at all (PUBLIC shares) while still
// learning WHO is asking when a session does exist (AUTHORIZED shares -
// see NotebookService.getSharedEntry). Never use this in place of
// JwtAuthGuard on anything that assumes @CurrentUser() is non-null.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
