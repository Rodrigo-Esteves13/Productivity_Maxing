import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import {
  OAUTH_LOGIN_STATE_COOKIE,
  oauthLoginStateCookieOptions,
} from '../cookie.config';

// Ver GoogleAuthGuard para explicação da proteção de login CSRF.
@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (request.query.code) {
      return {};
    }

    const state = randomBytes(16).toString('hex');
    response.cookie(
      OAUTH_LOGIN_STATE_COOKIE,
      state,
      oauthLoginStateCookieOptions(),
    );
    return { state };
  }
}
