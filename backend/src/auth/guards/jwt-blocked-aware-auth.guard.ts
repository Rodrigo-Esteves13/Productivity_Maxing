import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Ver o comentário completo em jwt-blocked-aware.strategy.ts. Só deve
// proteger GET /account-status/me e POST /appeals - nunca mais nenhuma
// rota, ou isso reabre o acesso que um ban/suspend existe para fechar.
@Injectable()
export class JwtBlockedAwareGuard extends AuthGuard('jwt-blocked-aware') {}
