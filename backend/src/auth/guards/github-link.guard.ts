import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class GithubLinkGuard extends AuthGuard('github') {
  constructor(private authService: AuthService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: { id: string } }>();
    const state = this.authService.createLinkState(
      request.user.id,
      Provider.GITHUB,
    );
    return {
      state,
      scope: ['user:email'],
    };
  }
}
