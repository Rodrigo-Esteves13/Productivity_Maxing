import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
 
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
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
      const email = profile.emails?.[0]?.value ?? `${profile.id}@gmail.com`;
      const state = req.query.state as string | undefined;
      const data = {
        provider: Provider.GOOGLE,
        providerAccountId: profile.id,
        email,
        name: profile.displayName,
        accessToken,
        refreshToken,
      };
      const user = state
        ? await this.authService.linkIdentity(
            this.authService.consumeLinkState(state, Provider.GOOGLE),
            data,
          )
        : await this.authService.resolveIdentity(data);
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}