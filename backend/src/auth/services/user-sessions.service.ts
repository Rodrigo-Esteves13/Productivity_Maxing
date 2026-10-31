import {
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'crypto';
import {
  Prisma,
  SecurityEventType,
  SessionRevokeReason,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStateService } from '../../account-status/session-state.service';
import { SecurityLogsService } from '../../security-logs/security-logs.service';
import { RefreshTokenCodec } from '../refresh-token.codec';
import { maskIp, truncateUserAgent } from '../session-client.util';
import { runInBackground } from '../../common/background.util';
import { NewDeviceAlertService } from './new-device-alert.service';
import {
  GRACE_WINDOW_MS,
  MAX_GRACE_ENTRIES,
  REFRESH_TOKEN_TTL_MS,
  REVOKED_SESSION_RETENTION_MS,
} from '../session.constants';

// Dados do pedido que criou/renovou a sessao. ip e userAgent sao guardados
// ja reduzidos (ver session-client.util.ts); method/path so servem para o
// SecurityLog de uma reutilizacao.
export interface SessionClientInfo {
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RotatedSession extends IssuedSession {
  user: User;
}

export interface DeviceSessionView {
  id: string;
  userAgent: string | null;
  ipMasked: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
}

// Resultado da transacao do refresh. As rejeicoes saem da transacao como
// valor (e nao como excecao) para a revogacao feita la dentro ficar gravada:
// uma excecao dentro de $transaction desfazia-a.
// replacedHash: o hash que estava na BD e acabou de ser substituido (passa a
// ser o "anterior" lembrado). viaGrace: a rotacao veio do token anterior,
// dentro da janela de tolerancia (resposta perdida).
type RotationOutcome =
  | {
      kind: 'rotated';
      session: RotatedSession;
      replacedHash: string;
      viaGrace: boolean;
    }
  | { kind: 'invalid' }
  | { kind: 'conflict' }
  | { kind: 'reuse'; userId: string };

// Teto de linhas devolvidas na lista de dispositivos (uma conta normal tem
// meia duzia; isto so evita uma resposta gigante num caso patologico).
const MAX_LISTED_SESSIONS = 100;
const DEFAULT_REFRESH_METHOD = 'POST';
const DEFAULT_REFRESH_PATH = '/auth/refresh';
const INVALID_REFRESH_MESSAGE = 'Session expired. Please log in again.';

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Ultima rotacao de uma sessao, para a tolerancia a resposta perdida.
// graceSpent: esta entrada ja nasceu de uma rotacao por tolerancia e nao
// autoriza outra (sem encadear: ver o comentario da classe).
interface RotationMemory {
  previousHash: string;
  rotatedAt: number;
  graceSpent: boolean;
}

/**
 * Sessoes por dispositivo com refresh token rodado a cada uso.
 *
 * Regras do refresh (rotate):
 * - O token roda SEMPRE: o antigo deixa de valer no mesmo instante.
 * - Troca atomica (compare-and-swap): o UPDATE so acontece se o hash ainda
 *   for o que foi apresentado, por isso dois refreshes simultaneos com o
 *   mesmo token nunca tem os dois sucesso (o segundo fica a 0 linhas).
 * - Reutilizacao: um token com mac valido desta sessao que ja nao e o atual
 *   foi rodado antes. Isso so acontece se alguem tem uma copia (roubo do
 *   cookie): a sessao inteira e revogada e fica um SecurityLog.
 * - Unica tolerancia: o perdedor de uma corrida exatamente simultanea (os
 *   dois pedidos dentro da mesma transacao) recebe 401 sem revogar a
 *   sessao. A janela e a duracao de um UPDATE (milissegundos) e um atacante
 *   nao a consegue alargar; sem isto, dois pedidos do proprio browser a
 *   colidir terminavam a sessao legitima. Qualquer uso posterior do token
 *   antigo ja conta como reutilizacao.
 * - Resposta perdida (tolerancia): se a resposta de um refresh se perde
 *   depois do commit (separador fechado, rede caiu), o browser fica com o
 *   cookie ANTIGO e o proximo refresh parecia reutilizacao. Por isso fica em
 *   memoria, por sessao, o hash imediatamente anterior e a hora da rotacao.
 *   Esse token anterior, apresentado ate GRACE_WINDOW_MS depois, roda UMA vez
 *   (compare-and-swap contra o hash ATUAL da BD), com um aviso no log em vez
 *   de revogar. So se a sessao continuar valida (nao revogada, nao expirada,
 *   tokenVersion certa). Tudo o resto continua estrito: fora da janela, um
 *   hash que nao e o imediatamente anterior (duas rotacoes atras ou mais),
 *   ou depois de um restart (memoria vazia) conta como reutilizacao.
 * - Sem encadear: a entrada criada por uma rotacao de tolerancia ja nao
 *   autoriza outra. Sem isto, um ladrao com o token anterior e o browser
 *   legitimo podiam rodar alternadamente para sempre sem ninguem ser
 *   apanhado; assim, o proximo refresh do browser legitimo (que ficou com o
 *   token que o ladrao invalidou) e tratado como reutilizacao e mata tudo.
 * - Limitacoes (assumidas, iguais as caches do SessionStateService /
 *   TaskMetaCacheService): memoria so desta instancia (o deploy e de uma
 *   instancia so), perde-se num restart (volta a ser estrito, nunca mais
 *   permissivo) e e limitada a MAX_GRACE_ENTRIES sessoes (sai a mais
 *   antiga). Quem roubou o token imediatamente anterior e o usa dentro da
 *   janela consegue rodar uma vez; fica no log e a reutilizacao e detetada
 *   no refresh seguinte do dispositivo legitimo.
 * - tokenVersion: se a do User subiu (troca de password, "terminar sessao em
 *   todo o lado"), o refresh recusa e revoga - o interruptor global continua
 *   a cortar tudo.
 */
@Injectable()
export class UserSessionsService {
  private readonly logger = new Logger(UserSessionsService.name);
  private readonly codec: RefreshTokenCodec;
  // sessionId -> ultima rotacao (ver "Resposta perdida" acima). Ordem de
  // insercao = ordem das rotacoes, por isso a primeira chave e a mais antiga.
  private readonly lastRotations = new Map<string, RotationMemory>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionState: SessionStateService,
    private readonly securityLogs: SecurityLogsService,
    // Opcional: sem ele (testes) a criacao de sessao nao avisa ninguem.
    @Optional() private readonly deviceAlerts?: NewDeviceAlertService,
  ) {
    // Sem fallback: a validacao de arranque (main.ts) ja exige JWT_SECRET, e
    // o RefreshTokenCodec rebenta se vier vazio.
    this.codec = new RefreshTokenCodec(process.env.JWT_SECRET ?? '');
  }

  /** Nova sessao (login por qualquer via). */
  async create(
    user: Pick<User, 'id' | 'tokenVersion'>,
    client: SessionClientInfo,
    now: Date = new Date(),
  ): Promise<IssuedSession> {
    const issued = await this.insert(user, client, now);
    this.alertIfNewDevice(user.id, issued.sessionId, client, now);
    return issued;
  }

  /**
   * Sessao para um browser que JA tinha login (JWT antigo, anterior as
   * sessoes por dispositivo, sem `sid`). Nao e um inicio de sessao novo, por
   * isso nunca dispara o alerta de novo dispositivo: sem isto, cada utilizador
   * com dois ou mais aparelhos recebia um falso "novo inicio de sessao" por
   * aparelho na semana a seguir ao deploy.
   */
  adoptLegacy(
    user: Pick<User, 'id' | 'tokenVersion'>,
    client: SessionClientInfo,
    now: Date = new Date(),
  ): Promise<IssuedSession> {
    return this.insert(user, client, now);
  }

  private async insert(
    user: Pick<User, 'id' | 'tokenVersion'>,
    client: SessionClientInfo,
    now: Date,
  ): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const { token, hash } = this.codec.mint(sessionId);
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hash,
        tokenVersion: user.tokenVersion,
        userAgent: truncateUserAgent(client.userAgent),
        ipMasked: maskIp(client.ip),
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });
    return { sessionId, refreshToken: token, expiresAt };
  }

  // So a criacao real de uma sessao (login) chega aqui; rotate() nunca avisa.
  // Segundo plano: um SMTP ou push lento/em erro nunca atrasa nem parte o login.
  private alertIfNewDevice(
    userId: string,
    sessionId: string,
    client: SessionClientInfo,
    at: Date,
  ): void {
    const alerts = this.deviceAlerts;
    if (!alerts) return;
    runInBackground(
      Promise.resolve().then(() =>
        alerts.checkAndNotify({ userId, sessionId, client, at }),
      ),
      this.logger,
      'New device alert',
    );
  }

  /** Troca o refresh token por um novo. Lanca 401 em qualquer rejeicao. */
  async rotate(
    rawToken: string | undefined,
    client: SessionClientInfo,
    now: Date = new Date(),
  ): Promise<RotatedSession> {
    const sessionId = this.codec.parse(rawToken);
    if (!sessionId || !rawToken) {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }
    const presentedHash = RefreshTokenCodec.hash(rawToken);

    const outcome = await this.prisma.$transaction((tx) =>
      this.rotateInTransaction(tx, sessionId, presentedHash, client, now),
    );

    if (outcome.kind === 'rotated') {
      this.rememberRotation(sessionId, outcome, now);
      return outcome.session;
    }

    if (outcome.kind === 'reuse') {
      // A sessao morreu: a memoria da ultima rotacao ja nao serve. (Num
      // 'conflict' nao se apaga: a entrada e a do vencedor da corrida.)
      this.lastRotations.delete(sessionId);
      this.sessionState.invalidateDeviceSession(sessionId);
      this.logger.warn(
        `Refresh token reuse detected: session ${sessionId} revoked (user ${outcome.userId}).`,
      );
      await this.securityLogs.recordEvent({
        type: SecurityEventType.REFRESH_TOKEN_REUSE,
        ip: client.ip ?? '',
        method: client.method ?? DEFAULT_REFRESH_METHOD,
        path: client.path ?? DEFAULT_REFRESH_PATH,
        userAgent: truncateUserAgent(client.userAgent),
        userId: outcome.userId,
      });
    } else {
      // invalid (inclui tokenVersion antiga, ja revogada la dentro) ou
      // conflict: nada a registar alem do 401.
      this.sessionState.invalidateDeviceSession(sessionId);
    }
    throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
  }

  private async rotateInTransaction(
    tx: Prisma.TransactionClient,
    sessionId: string,
    presentedHash: string,
    client: SessionClientInfo,
    now: Date,
  ): Promise<RotationOutcome> {
    const session = await tx.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      return { kind: 'invalid' };
    }

    // Token com mac valido mas que ja nao e o atual: reutilizacao, salvo se
    // for o retry de uma resposta perdida (tolerancia, ver a classe).
    const viaGrace = !hashesMatch(session.refreshTokenHash, presentedHash);
    if (viaGrace && !this.isGraceRetry(sessionId, presentedHash, now)) {
      await tx.userSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: SessionRevokeReason.TOKEN_REUSE,
        },
      });
      return { kind: 'reuse', userId: session.userId };
    }

    if (session.tokenVersion !== session.user.tokenVersion) {
      await tx.userSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: SessionRevokeReason.GLOBAL_SIGNOUT,
        },
      });
      return { kind: 'invalid' };
    }

    const next = this.codec.mint(sessionId);
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    // Compare-and-swap: so muda se o hash ainda for o que se leu. Num refresh
    // normal e o apresentado; na tolerancia e o ATUAL da BD (nunca o
    // apresentado, que ja nao esta la), por isso duas tentativas simultaneas
    // continuam a ter um so vencedor.
    const { count } = await tx.userSession.updateMany({
      where: {
        id: sessionId,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: next.hash,
        lastSeenAt: now,
        expiresAt,
        userAgent: truncateUserAgent(client.userAgent) ?? session.userAgent,
        ipMasked: maskIp(client.ip) ?? session.ipMasked,
      },
    });
    if (count !== 1) return { kind: 'conflict' };

    return {
      kind: 'rotated',
      session: {
        user: session.user,
        sessionId,
        refreshToken: next.token,
        expiresAt,
      },
      replacedHash: session.refreshTokenHash,
      viaGrace,
    };
  }

  /**
   * O token apresentado (mac valido, mas ja nao e o atual) e o
   * imediatamente anterior desta sessao, dentro da janela, e essa rotacao
   * ainda nao veio ela propria da tolerancia? So le a memoria; a validade da
   * sessao (revogada, expirada, tokenVersion) e verificada por quem chama.
   */
  private isGraceRetry(
    sessionId: string,
    presentedHash: string,
    now: Date,
  ): boolean {
    const memory = this.lastRotations.get(sessionId);
    if (!memory) return false;
    const elapsed = now.getTime() - memory.rotatedAt;
    return (
      !memory.graceSpent &&
      elapsed >= 0 &&
      elapsed <= GRACE_WINDOW_MS &&
      hashesMatch(memory.previousHash, presentedHash)
    );
  }

  /**
   * Guarda o hash acabado de substituir como "anterior" desta sessao, so
   * depois do commit. Uma rotacao por tolerancia fica marcada (graceSpent) e
   * deixa um aviso: nao e alarme (o caso normal e uma resposta perdida), mas
   * fica observavel. Sem SecurityLog: o enum nao tem um tipo de baixa
   * severidade para isto e RATE_LIMIT_EXCEEDED sujava as estatisticas.
   */
  private rememberRotation(
    sessionId: string,
    outcome: Extract<RotationOutcome, { kind: 'rotated' }>,
    now: Date,
  ): void {
    // Apagar antes de inserir mantem a ordem do Map = ordem das rotacoes.
    this.lastRotations.delete(sessionId);
    while (this.lastRotations.size >= MAX_GRACE_ENTRIES) {
      const oldest = this.lastRotations.keys().next();
      if (oldest.done) break;
      this.lastRotations.delete(oldest.value);
    }
    this.lastRotations.set(sessionId, {
      previousHash: outcome.replacedHash,
      rotatedAt: now.getTime(),
      graceSpent: outcome.viaGrace,
    });
    if (outcome.viaGrace) {
      this.logger.warn(
        `Refresh retried with the previous token inside the grace window: session ${sessionId} rotated once (user ${outcome.session.user.id}).`,
      );
    }
  }

  /**
   * Revoga UMA sessao do proprio utilizador. O userId vai no where: o id de
   * uma sessao de outra pessoa da 0 linhas, exatamente como um id que nao
   * existe (quem chama devolve 404 nos dois casos).
   */
  async revoke(
    userId: string,
    sessionId: string,
    reason: SessionRevokeReason,
    now: Date = new Date(),
  ): Promise<boolean> {
    const { count } = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
    this.sessionState.invalidateDeviceSession(sessionId);
    return count > 0;
  }

  /**
   * Revoga todas as sessoes do utilizador, menos (opcionalmente) uma.
   * `client`: ver SessionStateService.bumpTokenVersion (numa transacao, quem
   * chama invalida a cache outra vez depois do commit).
   */
  async revokeAllExcept(
    userId: string,
    reason: SessionRevokeReason,
    keepSessionId?: string,
    now: Date = new Date(),
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const { count } = await client.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
      },
      data: { revokedAt: now, revokedReason: reason },
    });
    this.sessionState.invalidateDeviceSessionsOfUser(userId);
    return count;
  }

  /**
   * Depois de subir a tokenVersion (troca de password neste dispositivo), a
   * sessao que continua passa a ter a versao nova - senao o proximo refresh
   * recusava-a como "anterior ao interruptor global".
   */
  async confirmTokenVersion(
    userId: string,
    sessionId: string,
    tokenVersion: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { tokenVersion },
    });
  }

  /** A sessao ainda vale para este utilizador? (cache de 30s) */
  isActive(sessionId: string, userId: string): Promise<boolean> {
    return this.sessionState.isDeviceSessionActive(sessionId, userId);
  }

  /** Sessoes ativas do utilizador, a do pedido atual marcada com current. */
  async list(
    userId: string,
    currentSessionId: string | undefined,
    now: Date = new Date(),
  ): Promise<DeviceSessionView[]> {
    const state = await this.sessionState.get(userId);
    if (!state) return [];
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        // Sessoes anteriores ao ultimo interruptor global ja nao renovam.
        tokenVersion: state.tokenVersion,
      },
      select: {
        id: true,
        userAgent: true,
        ipMasked: true,
        createdAt: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
      take: MAX_LISTED_SESSIONS,
    });
    return rows.map((row) => ({
      ...row,
      current: row.id === currentSessionId,
    }));
  }
}

/**
 * Limpeza periodica (chamada pelo cron em RemindersService): apaga sessoes
 * cujo refresh ja expirou e as revogadas ha mais de
 * REVOKED_SESSION_RETENTION_MS. Funcao solta (so precisa do Prisma) para o
 * modulo dos lembretes nao ter de importar o AuthModule.
 */
export async function deleteStaleUserSessions(
  prisma: Pick<PrismaService, 'userSession'>,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.userSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        {
          revokedAt: {
            lt: new Date(now.getTime() - REVOKED_SESSION_RETENTION_MS),
          },
        },
      ],
    },
  });
  return count;
}
