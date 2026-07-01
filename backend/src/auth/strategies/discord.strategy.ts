import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { Request } from 'express';
import { Provider, User } from '@prisma/client';
import { AuthService } from '../auth.service';
 
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
      const discordProfile = profile as Profile & { global_name?: string };
      const data = {
        provider: Provider.DISCORD,
        providerAccountId: profile.id,
        email,
        name: discordProfile.global_name || profile.username,
        accessToken,
        refreshToken,
      };
      const user = state
        ? await this.authService.linkIdentity(
            this.authService.consumeLinkState(state, Provider.DISCORD),
            data,
          )
        : await this.authService.resolveIdentity(data);
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
