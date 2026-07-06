import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { Request } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';

//Define an explicit type that extends the default passport email shape
type GithubEmail = {
  value: string;
  type?: string;
  verified?: boolean;
  primary?: boolean;
};

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
    done: (err: Error | null, user?: any) => void,
  ) {
    try {
      //Safely cast the emails array to your custom type
      const emails = profile.emails as GithubEmail[] | undefined;
      const emailObj = emails?.[0];
      
      const email = emailObj?.value ?? `${profile.username}@github.com`;
      const state = req.query.state as string | undefined;
      
      const data = {
        provider: Provider.GITHUB,
        providerAccountId: profile.id,
        email,
        name: profile.displayName || profile.username,
        accessToken,
        refreshToken,
        // The compiler now explicitly knows 'verified' is a valid optional boolean
        emailVerified: emailObj?.verified === true,
      };

      let user;
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