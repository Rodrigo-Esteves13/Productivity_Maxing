import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { buildLoginAuthenticateOptions } from './oauth-guard.helpers';

// Ver oauth-guard.helpers.ts para a explicação da proteção de login CSRF.
@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return buildLoginAuthenticateOptions(request, response);
  }
}
