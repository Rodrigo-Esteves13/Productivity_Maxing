import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { Request } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
 
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
      const email = profile.emails?.[0]?.value ?? `${profile.username}@github.com`;
      const state = req.query.state as string | undefined;
      const data = {
        provider: Provider.GITHUB,
        providerAccountId: profile.id,
        email,
        name: profile.displayName || profile.username,
        accessToken,
        refreshToken,
      };
      const user = state
        ? await this.authService.linkIdentity(
            this.authService.consumeLinkState(state, Provider.GITHUB),
            data,
          )
        : await this.authService.resolveIdentity(data);
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}