import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ACCESS_TOKEN_COOKIE } from '../cookie.config';

// Extrai o JWT do cookie HttpOnly em vez do header Authorization - o token
// já não é acessível a JS no browser, o que é o ponto todo da migração.
function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    // Sem fallback para '': assinar/verificar com uma secret vazia deixaria
    // qualquer atacante forjar tokens válidos (jwt.sign(payload, '')) se
    // JWT_SECRET não estivesse definida em produção por erro de config.
    // A validação de arranque em main.ts garante que chegamos aqui sempre
    // com a variável definida; isto é a segunda linha de defesa.
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não está definida.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
      // Restringe explicitamente o algoritmo aceite - defesa em
      // profundidade contra ataques de "algorithm confusion" (ex: aceitar
      // "alg: none" ou trocar um esquema assimétrico por HMAC usando a
      // chave pública como secret).
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload) {
    // fica disponível como req.user em qualquer rota protegida por JwtAuthGuard
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
