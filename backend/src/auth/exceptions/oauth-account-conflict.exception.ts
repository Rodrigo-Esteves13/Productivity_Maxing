import { ConflictException } from '@nestjs/common';

/**
 * Lançada em resolveIdentity() quando um login OAuth (Google/GitHub/Discord)
 * encontra um email que já pertence a outro User, mas não podemos fazer
 * auto-merge com segurança (o provider não confirma que o email é dele).
 *
 * É uma classe própria, e não um ConflictException genérico, para que o
 * OAuthConflictRedirectFilter a consiga apanhar especificamente nas rotas
 * de callback OAuth e redirecionar para o frontend com uma mensagem
 * amigável - em vez de devolver o JSON cru da exceção diretamente no
 * browser (que é o que acontece numa navegação GET normal para uma rota
 * de callback, já que não é um pedido fetch/XHR do frontend).
 */
export class OAuthAccountConflictException extends ConflictException {
  constructor(public readonly conflictEmail: string) {
    super(
      `An account with the email ${conflictEmail} already exists. Sign in with your original method, then link this provider from your profile settings.`,
    );
  }
}