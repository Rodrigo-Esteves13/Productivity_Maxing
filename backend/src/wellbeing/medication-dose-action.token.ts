import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomUUID } from 'crypto';
import { DATE_KEY_PATTERN, toDateKey } from '../common/date-key.util';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../common/time.constants';
import {
  MAX_CONSUMED_DOSE_ACTION_TOKENS,
  MEDICATION_DOSE_ACTION_KEY_LABEL,
  MEDICATION_DOSE_ACTION_PURPOSE,
  MEDICATION_REMINDER_WINDOW_MINUTES,
  MINUTES_PER_DAY,
} from './wellbeing.constants';

const DOSE_ACTION_ALGORITHM = 'HS256';
const DOSE_ACTION_TTL_SECONDS =
  (MEDICATION_REMINDER_WINDOW_MINUTES * MS_PER_MINUTE) / MS_PER_SECOND;

/** A toma a que o token se refere. */
export interface DoseActionTarget {
  userId: string;
  medicationId: string;
  date: Date;
  slotMinutes: number;
}

/** Claims ja validados de um token de "Tomei". */
export interface DoseActionClaims {
  userId: string;
  medicationId: string;
  dateKey: string;
  slotMinutes: number;
  jti: string;
  /** Expiracao em segundos (epoch), como no JWT. */
  exp: number;
}

interface RawDoseActionPayload {
  sub?: unknown;
  mid?: unknown;
  date?: unknown;
  slot?: unknown;
  purpose?: unknown;
  jti?: unknown;
  exp?: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Token do botao "Tomei" das notificacoes de medicacao.
 *
 * - Assinado (HS256) com um segredo DERIVADO do JWT_SECRET com rotulo
 *   proprio: nunca e aceite como sessao (o JwtStrategy usa o JWT_SECRET
 *   direto) nem como link de email/2FA, e nenhum desses vale aqui.
 * - Claims: dono (sub), medicamento (mid), dia (date) e hora (slot) de UMA
 *   toma, purpose fixo e jti unico. Expira com o proprio push.
 * - Uso unico por processo: o jti fica em memoria ate expirar. Uma segunda
 *   chamada nao volta a escrever (ver MedicationsService.takeDoseFromAction).
 */
@Injectable()
export class MedicationDoseActionTokenService {
  // Sem dependencias: o segredo vem do ambiente, como nos outros tokens
  // derivados (password-link, verificacao de email).
  private readonly jwt = new JwtService();
  // jti -> exp (ms). Map guarda a ordem de insercao: o mais antigo sai primeiro.
  private readonly consumed = new Map<string, number>();

  private signingSecret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not defined.');
    return createHmac('sha256', base)
      .update(MEDICATION_DOSE_ACTION_KEY_LABEL)
      .digest('hex');
  }

  issue(target: DoseActionTarget): string {
    return this.jwt.sign(
      {
        sub: target.userId,
        mid: target.medicationId,
        date: toDateKey(target.date),
        slot: target.slotMinutes,
        purpose: MEDICATION_DOSE_ACTION_PURPOSE,
      },
      {
        secret: this.signingSecret(),
        algorithm: DOSE_ACTION_ALGORITHM,
        expiresIn: DOSE_ACTION_TTL_SECONDS,
        jwtid: randomUUID(),
      },
    );
  }

  /** Claims validados, ou null (assinatura, expiracao, purpose ou forma). */
  verify(token: string): DoseActionClaims | null {
    let raw: RawDoseActionPayload;
    try {
      raw = this.jwt.verify<RawDoseActionPayload & object>(token, {
        secret: this.signingSecret(),
        algorithms: [DOSE_ACTION_ALGORITHM],
      });
    } catch {
      return null;
    }
    const { sub, mid, date, slot, purpose, jti, exp } = raw;
    if (
      purpose !== MEDICATION_DOSE_ACTION_PURPOSE ||
      !isNonEmptyString(sub) ||
      !isNonEmptyString(mid) ||
      !isNonEmptyString(jti) ||
      typeof date !== 'string' ||
      !DATE_KEY_PATTERN.test(date) ||
      typeof slot !== 'number' ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= MINUTES_PER_DAY ||
      typeof exp !== 'number'
    ) {
      return null;
    }
    return {
      userId: sub,
      medicationId: mid,
      dateKey: date,
      slotMinutes: slot,
      jti,
      exp,
    };
  }

  /** Este token ja foi usado (e ainda nao expirou)? */
  wasConsumed(claims: DoseActionClaims, now = Date.now()): boolean {
    const exp = this.consumed.get(claims.jti);
    return exp !== undefined && exp > now;
  }

  /** Marca o token como usado ate expirar. */
  markConsumed(claims: DoseActionClaims, now = Date.now()): void {
    this.prune(now);
    this.consumed.set(claims.jti, claims.exp * MS_PER_SECOND);
  }

  private prune(now: number): void {
    for (const [jti, exp] of this.consumed) {
      if (exp <= now) this.consumed.delete(jti);
    }
    // Ainda cheio: descarta os mais antigos (expiram primeiro).
    while (this.consumed.size >= MAX_CONSUMED_DOSE_ACTION_TOKENS) {
      const oldest = this.consumed.keys().next();
      if (oldest.done) break;
      this.consumed.delete(oldest.value);
    }
  }
}
