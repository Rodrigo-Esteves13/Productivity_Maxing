import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';

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
      const emailObj = profile.emails?.[0] as
        | { value: string; verified?: boolean }
        | undefined;
      const email = emailObj?.value ?? `${profile.id}@gmail.com`;
      const state = req.query.state as string | undefined;
      const data = {
        provider: Provider.GOOGLE,
        providerAccountId: profile.id,
        email,
        name: profile.displayName,
        accessToken,
        refreshToken,
        emailVerified: emailObj?.verified === true,
      };

      // O state ou é o JWT assinado do fluxo de "ligar conta", ou é o
      // token anti-CSRF aleatório do fluxo de login normal - nunca ambos.
      // Tentamos primeiro como link state; se não for válido como tal,
      // tratamos como login normal e validamos contra o cookie.
      let user;
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
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }

  // Protege o fluxo de login OAuth contra CSRF (RFC 6749 §10.12): o state
  // devolvido pelo Google tem de bater certo com o cookie httpOnly gerado
  // no início do fluxo (ver GoogleAuthGuard). Sem isto, um atacante
  // conseguia forçar a vítima a completar o callback com o code de uma
  // sessão do atacante.
  private assertLoginState(req: Request, state: string | undefined): void {
    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = cookies?.[OAUTH_LOGIN_STATE_COOKIE];
    if (!expected || !state || expected !== state) {
      throw new UnauthorizedException('Invalid or missing OAuth state.');
    }
  }
}