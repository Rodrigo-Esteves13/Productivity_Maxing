import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { AuthService } from '../auth.service';
import { AccountStatusService } from '../../account-status/account-status.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(
    private authService: AuthService,
    private accountStatus: AccountStatusService,
  ) {
    // Passamos APENAS as opções de configuração. O 'false' diz que não precisamos do 'req'.
    // O NestJS vai automaticamente injetar o método validate() ali em baixo no Passport
    super({ header: 'x-api-key', prefix: '' }, false);
  }
  async validate(apiKey: string) {
    const result = await this.authService.validateApiKey(apiKey);

    if (!result) {
      throw new UnauthorizedException('Invalid or revoked API key.');
    }

    // Mesmo efeito imediato de ban/suspend que o JwtStrategy - uma API
    // Key continua tecnicamente válida (não expira como o cookie), por
    // isso sem isto seria uma forma de contornar um ban.
    const { blocked, reason } = this.accountStatus.isBlocked(result.user.id);
    if (blocked) {
      throw new UnauthorizedException(reason);
    }

    // apiKeyScope only ever gets set here, on the API-key path - a normal
    // JWT session (see JwtStrategy) never sets it, which is exactly the
    // signal ApiKeyScopeGuard uses to tell "came in via API key" apart
    // from "real session, already fully trusted".
    return { ...result.user, apiKeyScope: result.scope };
  }
}
