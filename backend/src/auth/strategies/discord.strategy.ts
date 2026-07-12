import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { Request } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import { OAUTH_LOGIN_STATE_COOKIE } from '../cookie.config';
import { isValidLoginState } from '../guards/oauth-guard.helpers';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      callbackURL: process.env.DISCORD_CALLBACK_URL || '',
      scope: ['identify', 'email'],
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
      const email = profile.email ?? `${profile.id}@discord.com`;
      const state = req.query.state as string | undefined;
      const discordProfile = profile as Profile & {
        global_name?: string;
        avatar?: string | null;
      };
      const photo = discordProfile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${discordProfile.avatar}.${
            discordProfile.avatar.startsWith('a_') ? 'gif' : 'png'
          }`
        : undefined;
      const data = {
        provider: Provider.DISCORD,
        providerAccountId: profile.id,
        email,
        name: discordProfile.global_name || profile.username,
        accessToken,
        refreshToken,
        // O perfil do Discord não expõe um campo "verified" para o email,
        // por isso nunca podemos confiar nele para fazer auto-merge com
        // um User existente - ver resolveIdentity() em auth.service.ts.
        emailVerified: false,
        photo,
      };

      let user;
      if (state) {
        try {
          const userId = this.authService.consumeLinkState(
            state,
            Provider.DISCORD,
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
    // Comparação em tempo constante - ver isValidLoginState() em
    // oauth-guard.helpers.ts.
    if (!isValidLoginState(expected, state)) {
      throw new UnauthorizedException('Invalid or missing OAuth state.');
    }
  }
}
