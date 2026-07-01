import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import { Request } from 'express';
 
// Aplicado depois do JwtAuthGuard na rota /auth/google/link, por isso
// req.user já existe (vem do JWT) quando getAuthenticateOptions corre.
@Injectable()
export class GoogleLinkGuard extends AuthGuard('google') {
  constructor(private authService: AuthService) {
    super();
  }
 
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user: { id: string } }>();
    const state = this.authService.createLinkState(request.user.id, Provider.GOOGLE);
    return {
      state,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}
