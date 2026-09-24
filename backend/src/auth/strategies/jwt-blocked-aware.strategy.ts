import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import {
  JwtPayload,
  AppealTokenPayload,
} from '../interfaces/jwt-payload.interface';
import { ACCESS_TOKEN_COOKIE } from '../cookie.config';

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
}

/**
 * Variante do JwtStrategy que NUNCA rejeita uma conta SUSPENDED/BANNED -
 * de propósito, só para os dois endpoints que uma conta bloqueada ainda
 * tem de conseguir chamar: GET /account-status/me (para saber porque
 * está bloqueada) e POST /appeals (para recorrer). Ver
 * JwtBlockedAwareGuard - NUNCA usar esta strategy/guard em mais nenhuma
 * rota, isso reabriria exatamente o que JwtStrategy.validate() existe
 * para impedir (efeito imediato de um ban/suspend).
 *
 * Continua a validar assinatura/expiração/algoritmo do JWT da mesma
 * forma que JwtStrategy - a única diferença é não consultar
 * AccountStatusService. Aceita o token de DUAS formas, ao contrário de
 * JwtStrategy (só cookie):
 *   1. O cookie de sessão normal (ACCESS_TOKEN_COOKIE) - caso de uma
 *      conta bloqueada A MEIO de uma sessão já autenticada.
 *   2. Um "Authorization: Bearer <appealToken>" - caso de uma conta
 *      bloqueada NO PRÓPRIO LOGIN (nunca chega a existir cookie, ver
 *      AuthService.accountBlockedResponse). Este token é de curta
 *      duração (15 min) e tem "purpose: 'appeal'" - nunca é aceite por
 *      JwtStrategy normal (essa só lê o cookie, nunca este header).
 * Em qualquer dos dois casos o payload já tem sub/email/role, por isso
 * validate() trata-os da mesma forma.
 */
@Injectable()
export class JwtBlockedAwareStrategy extends PassportStrategy(
  Strategy,
  'jwt-blocked-aware',
) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload | AppealTokenPayload) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
