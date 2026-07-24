import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { Provider, User } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';
import { isValidLoginState } from '../guards/oauth-guard.helpers';
import { GOOGLE_TOKENINFO_URL } from '../google-oauth.constants';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

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

      // Scope efetivamente concedido pela Google neste consent (pode ser
      // menor do que o pedido, se a pessoa desmarcar algo no consent
      // screen). Guardado na Identity para o CalendarService saber, sem
      // chamar a Google, se esta conta já tem acesso ao Calendar.
      //
      // NOTA: o @nestjs/passport wraps a validate() com ...params (rest
      // parameter), o que faz _verify.length ser 0 - por isso o
      // passport-oauth2 nunca entra no ramo de arity 6 (que injetaria os
      // `params` do token exchange como 4º argumento) e chama sempre esta
      // função com 5 argumentos. Confiar nesse 4º argumento fazia o profile
      // real cair no parâmetro `params`, o done real cair no parâmetro
      // `profile`, e o `done` declarado ficar undefined -> erro em cadeia.
      // Por isso o scope tem de ser pedido à parte, ao endpoint tokeninfo,
      // usando o accessToken que já recebemos de forma fiável.
      const scope = await this.fetchGrantedScope(accessToken);
      const photo = profile.photos?.[0]?.value;

      const data = {
        provider: Provider.GOOGLE,
        providerAccountId: profile.id,
        email,
        name: profile.displayName,
        accessToken,
        refreshToken,
        emailVerified: isVerified,
        scope,
        photo,
      };

      let user: User | undefined;

      if (state) {
        // Separado em dois passos de propósito: só cai para o fluxo de
        // login se o `state` não for mesmo um link state válido (ex:
        // expirado, ou é o state de login normal). Antes, um erro real
        // dentro de linkIdentity() (ex: falha na BD) também caía neste
        // catch e tentava assertLoginState() a seguir - que falha sempre
        // aqui (não existe cookie de login state neste fluxo), mascarando
        // o erro verdadeiro atrás de um "Invalid or missing OAuth state"
        // sem nada no terminal a apontar para a causa real.
        let linkUserId: string | undefined;
        try {
          linkUserId = this.authService.consumeLinkState(
            state,
            Provider.GOOGLE,
          );
        } catch {
          linkUserId = undefined;
        }

        if (linkUserId) {
          user = await this.authService.linkIdentity(linkUserId, data);
        } else {
          this.assertLoginState(req, state);
          user = await this.authService.resolveIdentity(data);
        }
      } else {
        this.assertLoginState(req, state);
        user = await this.authService.resolveIdentity(data);
      }

      done(null, user);
    } catch (err) {
      // Log explícito aqui: done(err) devolve sempre "Internal server
      // error" genérico ao browser (não é um HttpException), por isso sem
      // isto a causa real nunca aparecia em lado nenhum, nem no terminal.
      this.logger.error('Falha no callback OAuth Google', err as Error);
      done(err as Error, undefined);
    }
  }

  /**
   * Consulta o tokeninfo endpoint da Google com o accessToken recebido para
   * saber exatamente que scope foi concedido neste consent. Nunca deve
   * derrubar o login/link por si só - se a chamada falhar, seguimos sem
   * scope (o CalendarService trata scope undefined como "sem acesso ao
   * Calendar", o que é o comportamento seguro por omissão).
   */
  private async fetchGrantedScope(
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const res = await fetch(
        `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      if (!res.ok) {
        this.logger.warn(
          `tokeninfo devolveu ${res.status} ao verificar o scope concedido`,
        );
        return undefined;
      }
      const data = (await res.json()) as { scope?: string };
      return data.scope;
    } catch (err) {
      this.logger.warn(
        'Falha ao consultar tokeninfo para obter o scope',
        err as Error,
      );
      return undefined;
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
