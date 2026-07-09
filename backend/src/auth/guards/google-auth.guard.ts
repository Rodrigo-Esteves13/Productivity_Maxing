import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { buildLoginAuthenticateOptions } from './oauth-guard.helpers';

// Usado tanto para /auth/google (início do login) como para
// /auth/google/callback, a GoogleStrategy trata da distinção internamente.
// Ver oauth-guard.helpers.ts para a explicação da proteção de login CSRF.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return buildLoginAuthenticateOptions(request, response, {
      accessType: 'offline',
      prompt: 'consent',
    });
  }
}
