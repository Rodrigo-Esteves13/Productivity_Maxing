import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { Request } from 'express';
import { Provider, User } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  // <- A palavra 'export' está aqui!
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
      const emailObj = profile.emails?.[0];
      const email = emailObj?.value ?? `${profile.username}@github.com`;
      const state = req.query.state as string | undefined;

      // @ts-expect-error: A tipagem do passport-github2 não inclui 'verified', mas a API devolve.
      const isVerified = emailObj?.verified === true;

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

  private assertLoginState(req: Request, state: string | undefined): void {
    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = cookies?.[OAUTH_LOGIN_STATE_COOKIE];
    if (!expected || !state || expected !== state) {
      throw new UnauthorizedException('Invalid or missing OAuth state.');
    }
  }
}
