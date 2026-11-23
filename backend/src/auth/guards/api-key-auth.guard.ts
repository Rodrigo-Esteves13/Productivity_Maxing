import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { guardApiKeyFailures } from '../api-key-failure.tracker';

// Limite de falhas por IP antes do scrypt: ver api-key-failure.tracker.ts.
@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('api-key') {
  canActivate(context: ExecutionContext): Promise<boolean> {
    return guardApiKeyFailures(
      context,
      async () => (await super.canActivate(context)) as boolean,
    );
  }
}
