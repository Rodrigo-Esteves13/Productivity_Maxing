import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountGuardService } from './services/account-guard.service';
import { ApiKeyService } from './services/api-key.service';
import { AvatarService } from './services/avatar.service';
import { OAuthIdentityService } from './services/oauth-identity.service';
import { PasswordAuthService } from './services/password-auth.service';
import { SessionTokenService } from './services/session-token.service';
import { SupabaseClientsService } from './services/supabase-clients.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { DiscordStrategy } from './strategies/discord.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtBlockedAwareStrategy } from './strategies/jwt-blocked-aware.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { GoogleCalendarLinkGuard } from './guards/google-calendar-link.guard';
import { AccountStatusModule } from '../account-status/account-status.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AccountStatusModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseClientsService,
    AccountGuardService,
    OAuthIdentityService,
    PasswordAuthService,
    AvatarService,
    SessionTokenService,
    ApiKeyService,
    JwtStrategy,
    JwtBlockedAwareStrategy,
    GoogleStrategy,
    GithubStrategy,
    DiscordStrategy,
    ApiKeyStrategy,
    GoogleCalendarLinkGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
