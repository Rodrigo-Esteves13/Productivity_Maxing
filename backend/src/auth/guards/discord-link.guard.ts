import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { buildLinkAuthenticateOptions } from './oauth-guard.helpers';

// Ver oauth-guard.helpers.ts para a lógica partilhada com os outros *LinkGuard.
@Injectable()
export class DiscordLinkGuard extends AuthGuard('discord') {
  constructor(private authService: AuthService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: { id: string } }>();

    return buildLinkAuthenticateOptions(this.authService, request, Provider.DISCORD, [
      'identify',
      'email',
    ]);
  }
}
