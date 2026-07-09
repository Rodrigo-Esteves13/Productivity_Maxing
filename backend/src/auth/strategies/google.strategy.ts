import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { Provider, User } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';
import { isValidLoginState } from '../guards/oauth-guard.helpers';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      // v1.0: só scopes non-sensitive (email/profile), para o login com
      // Google não disparar o ecrã "app não verificada" nem consumir o
      // limite de 100 novos utilizadores enquanto não estivermos
      // verificados. O scope do Calendar volta aqui quando a sincronização
      // (Fase 4 / v1.1) estiver pronta - nessa altura também é preciso
      // submeter o projeto para verificação na Google (scope "sensitive",
      // sem CASA/security assessment, porque não é restricted).
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    try {
      const emailObj = profile.emails?.[0];
      const email = emailObj?.value ?? `${profile.id}@gmail.com`;
      const state = req.query.state as string | undefined;

      const isVerified =
        (emailObj as { verified?: boolean } | undefined)?.verified === true;

      const data = {
        provider: Provider.GOOGLE,
        providerAccountId: profile.id,
        email,
        name: profile.displayName,
        accessToken,
        refreshToken,
        emailVerified: isVerified,
      };

      let user: User | undefined;

      if (state) {
        try {
          const userId = this.authService.consumeLinkState(
            state,
            Provider.GOOGLE,
          );
          user = await this.authService.linkIdentity(userId, data);
        } catch {
          this.assertLoginState(req, state);
          user = await this.authService.resolveIdentity(data);
        }
      } else {
        this.assertLoginState(req, state);
        user = await this.authService.resolveIdentity(data);
      }

      // Forçamos o ESLint a ignorar o falso positivo do no-unsafe-argument nesta linha

      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }

  private assertLoginState(req: Request, state: string | undefined): void {
    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = cookies?.[OAUTH_LOGIN_STATE_COOKIE];
    // Comparação em tempo constante - ver isValidLoginState() em
    // oauth-guard.helpers.ts.
    if (!isValidLoginState(expected, state)) {
      throw new UnauthorizedException('Invalid or missing OAuth state.');
    }
  }
}
