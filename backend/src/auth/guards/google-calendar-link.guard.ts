import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { buildLinkAuthenticateOptions } from './oauth-guard.helpers';

// Igual ao GoogleLinkGuard, mas pede também o scope "sensitive" do Calendar
// (calendar.events, não o calendar completo - só precisamos de criar/editar
// eventos, não de ler a agenda toda). Fica separado do GoogleLinkGuard
// normal (email/profile) de propósito: ligar conta e autorizar o Calendar
// são ações distintas na UI (Fase 4 / issue #34), e mantemos o link
// genérico sem o scope sensitive para quem só quer SSO.
@Injectable()
export class GoogleCalendarLinkGuard extends AuthGuard('google') {
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
        ['email', 'profile', 'https://www.googleapis.com/auth/calendar.events'],
      ),
      // accessType: offline é obrigatório para recebermos um refresh_token
      // (sem ele só temos ~1h de acesso e nunca mais conseguimos renovar).
      // prompt: consent força a Google a mostrar sempre o ecrã de
      // permissões, mesmo que a pessoa já tenha uma Identity Google (email/
      // profile) ligada de antes - é o que garante o refresh_token novo com
      // o scope extra, em vez de reutilizar silenciosamente uma sessão sem
      // consentimento explícito para o Calendar.
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}
