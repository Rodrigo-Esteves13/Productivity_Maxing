import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import {
  OAUTH_LOGIN_STATE_COOKIE,
  oauthLoginStateCookieOptions,
} from '../cookie.config';

// Usado tanto para /auth/google (início do login) como para
// /auth/google/callback — a GoogleStrategy trata da distinção internamente.
//
// Proteção de login CSRF: no início do fluxo (GET /auth/google) geramos um
// state aleatório, guardamo-lo num cookie httpOnly de curta duração e
// mandamo-lo ao Google. A GoogleStrategy compara o state devolvido no
// callback com este cookie antes de aceitar o login.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // No callback (há ?code= na query) não geramos um state novo -
    // deixamos passar em branco para a Strategy usar o state que já veio
    // na query do provider.
    if (request.query.code) {
      return { accessType: 'offline', prompt: 'consent' };
    }

    const state = randomBytes(16).toString('hex');
    response.cookie(
      OAUTH_LOGIN_STATE_COOKIE,
      state,
      oauthLoginStateCookieOptions(),
    );
    return {
      state,
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}
