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
    const user = await this.authService.validateApiKey(apiKey);

    if (!user) {
      throw new UnauthorizedException('API Key inválida ou revogada.');
    }
    return user;
  }
}
