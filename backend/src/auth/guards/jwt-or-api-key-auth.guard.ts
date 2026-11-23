import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { guardApiKeyFailures } from '../api-key-failure.tracker';

// Aceita QUALQUER uma das duas: sessão JWT normal (cookie, usada pelo
// frontend) OU uma API Key válida (usada por scripts externos). O Passport
// tenta as strategies pela ordem do array e passa assim que uma validar -
// por isso a AuthenticatedUser injetada por @CurrentUser() é sempre a
// mesma forma (id/email/role), venha de onde vier.
//
// Usar isto em vez de JwtAuthGuard sozinho é o que faltava para as tasks
// serem scriptáveis com uma API Key pessoal (ver /auth/api-keys).
@Injectable()
export class JwtOrApiKeyAuthGuard extends AuthGuard(['jwt', 'api-key']) {
  // Falhas de API key contam por IP (api-key-failure.tracker.ts): passado
  // o teto, 429 antes do scrypt.
  canActivate(context: ExecutionContext): Promise<boolean> {
    return guardApiKeyFailures(
      context,
      async () => (await super.canActivate(context)) as boolean,
    );
  }
}
