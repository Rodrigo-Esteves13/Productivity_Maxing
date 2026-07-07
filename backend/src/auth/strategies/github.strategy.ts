import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { Request } from 'express';
import { Provider, User } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: process.env.GITHUB_CALLBACK_URL || '',
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: User) => void,
  ) {
    try {
      // CORREÇÃO: passport-github2 nunca preenche `verified`/`primary` no
      // profile.emails (só tem `{ value, type }`, vindo do endpoint /user,
      // não do /user/emails). Isso significava que `isVerified` era SEMPRE
      // false, nunca correspondendo à realidade - por isso qualquer conta
      // GitHub com um email já registado noutro provider caía sempre no
      // ConflictException, mesmo quando o email é de facto verificado no
      // GitHub. A forma correta é perguntar diretamente à API do GitHub.
      const primaryEmail = await this.fetchPrimaryEmail(accessToken);
      const email =
        primaryEmail?.email ??
        profile.emails?.[0]?.value ??
        `${profile.username}@github.com`;
      const isVerified = primaryEmail?.verified === true;

      const state = req.query.state as string | undefined;
      const data = {
        provider: Provider.GITHUB,
        providerAccountId: profile.id,
        email,
        name: profile.displayName || profile.username,
        accessToken,
        refreshToken,
        emailVerified: isVerified,
      };

      let user: User | undefined;
      if (state) {
        try {
          const userId = this.authService.consumeLinkState(
            state,
            Provider.GITHUB,
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

  /**
   * Vai à API do GitHub buscar o email primário real, com o campo
   * `verified` correto - só assim conseguimos confiar (ou não) neste email
   * para efeitos de auto-merge em resolveIdentity(). Requer o scope
   * `user:email`, que já pedimos no constructor.
   */
  private async fetchPrimaryEmail(
    accessToken: string,
  ): Promise<{ email: string; verified: boolean } | null> {
    try {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Productivity-Maxing',
          Accept: 'application/vnd.github+json',
        },
      });

      if (!res.ok) return null;

      const emails = (await res.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      const primary = emails.find((e) => e.primary) ?? emails[0];
      return primary
        ? { email: primary.email, verified: primary.verified }
        : null;
    } catch {
      // Se a API do GitHub falhar ou o rate limit disparar, seguimos em
      // frente sem email verificado - falha para o lado seguro (nunca
      // auto-merge), não para o lado inseguro.
      return null;
    }
  }

  private assertLoginState(req: Request, state: string | undefined): void {
    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = cookies?.[OAUTH_LOGIN_STATE_COOKIE];
    if (!expected || !state || expected !== state) {
      throw new UnauthorizedException('Invalid or missing OAuth state.');
    }
  }
}