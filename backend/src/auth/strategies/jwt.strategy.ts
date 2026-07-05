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
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '',
    });
  }

  validate(payload: JwtPayload) {
    // fica disponível como req.user em qualquer rota protegida por JwtAuthGuard
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
