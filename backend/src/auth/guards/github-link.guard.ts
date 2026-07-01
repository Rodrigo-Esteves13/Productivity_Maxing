import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
 
@Injectable()
export class GithubLinkGuard extends AuthGuard('github') {
  constructor(private authService: AuthService) {
    super();
  }
 
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = this.authService.createLinkState(req.user.id, Provider.GITHUB);
    return {
      state,
      scope: ['user:email'],
    };
  }
}
 
