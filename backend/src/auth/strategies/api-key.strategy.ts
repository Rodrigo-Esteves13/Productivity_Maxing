import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(private authService: AuthService) {
    // Passamos APENAS as opções de configuração. O 'false' diz que não precisamos do 'req'.
    // O NestJS vai automaticamente injetar o método validate() ali em baixo no Passport
    super({ header: 'x-api-key', prefix: '' }, false);
  }
  async validate(apiKey: string) {
    const result = await this.authService.validateApiKey(apiKey);

    if (!result) {
      throw new UnauthorizedException('Invalid or revoked API key.');
    }

    // apiKeyScope only ever gets set here, on the API-key path - a normal
    // JWT session (see JwtStrategy) never sets it, which is exactly the
    // signal ApiKeyScopeGuard uses to tell "came in via API key" apart
    // from "real session, already fully trusted".
    return { ...result.user, apiKeyScope: result.scope };
  }
}
