import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { buildLinkAuthenticateOptions } from './oauth-guard.helpers';

// Aplicado depois do JwtAuthGuard na rota /auth/google/link, por isso
// req.user já existe (vem do JWT) quando getAuthenticateOptions corre.
// Ver oauth-guard.helpers.ts para a lógica partilhada com os outros *LinkGuard.
@Injectable()
export class GoogleLinkGuard extends AuthGuard('google') {
  constructor(private authService: AuthService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: { id: string } }>();

    return {
      ...buildLinkAuthenticateOptions(
        this.authService,
        request,
        Provider.GOOGLE,
        ['email', 'profile'],
      ),
      // v1.0: mesmo scope do login (email/profile), o scope do Calendar
      // volta aqui quando a sincronização (Fase 4 / v1.1) estiver pronta.
      // Manter o Calendar só aqui e não no login já tinha sido corrigido
      // parcialmente; o Google avalia o projeto OAuth como um todo, por
      // isso pedir aqui o scope "sensitive" continua a arriscar o mesmo
      // ecrã de app não verificada / limite de 100 utilizadores que se
      // tentou evitar ao tirá-lo do login.
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}
