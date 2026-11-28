import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  API_KEY_FAILURE_MAX_TRACKED_IPS,
  API_KEY_FAILURE_WINDOW_MS,
  API_KEY_MAX_FAILURES_PER_WINDOW,
} from './dto/auth-limits';

// Header lido pela ApiKeyStrategy (o Express poe os nomes em minusculas).
export const API_KEY_HEADER = 'x-api-key';

const TOO_MANY_FAILURES_MESSAGE =
  'Too many invalid API key attempts. Try again later.';

interface FailureWindow {
  count: number;
  windowStart: number;
}

/**
 * Falhas de API key por IP, em memoria (so esta instancia, ver S-34). Uma
 * key invalida gastava um scrypt por pedido, sem limite proprio: era um DoS
 * barato. Passado o teto, o guard responde 429 antes de chegar ao Passport,
 * por isso o scrypt nem corre.
 */
export class ApiKeyFailureTracker {
  private readonly failures = new Map<string, FailureWindow>();

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked(ip: string): boolean {
    const entry = this.failures.get(ip);
    if (!entry) return false;
    if (this.now() - entry.windowStart >= API_KEY_FAILURE_WINDOW_MS) {
      this.failures.delete(ip);
      return false;
    }
    return entry.count >= API_KEY_MAX_FAILURES_PER_WINDOW;
  }

  recordFailure(ip: string): void {
    const now = this.now();
    const entry = this.failures.get(ip);
    if (entry && now - entry.windowStart < API_KEY_FAILURE_WINDOW_MS) {
      entry.count += 1;
      return;
    }
    this.failures.delete(ip);
    this.failures.set(ip, { count: 1, windowStart: now });
    this.prune(now);
  }

  get trackedIps(): number {
    return this.failures.size;
  }

  // Tira as janelas acabadas; se ainda passar do teto, esquece as mais
  // antigas (o Map guarda a ordem de insercao).
  private prune(now: number): void {
    if (this.failures.size <= API_KEY_FAILURE_MAX_TRACKED_IPS) return;
    for (const [ip, entry] of this.failures) {
      if (now - entry.windowStart >= API_KEY_FAILURE_WINDOW_MS) {
        this.failures.delete(ip);
      }
    }
    for (const ip of this.failures.keys()) {
      if (this.failures.size <= API_KEY_FAILURE_MAX_TRACKED_IPS) return;
      this.failures.delete(ip);
    }
  }
}

// Instancia unica do processo: os guards de API key sao instanciados por
// modulo (tasks, areas, feedback...) e nao podem depender de um provider do
// AuthModule sem o importar em todo o lado.
export const apiKeyFailureTracker = new ApiKeyFailureTracker();

interface ApiKeyRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Envolve o canActivate de um guard que aceita API key. So conta falhas
 * quando o pedido trouxe x-api-key: no JwtOrApiKeyAuthGuard, um cookie JWT
 * valido passa antes da strategy de API key e nunca chega aqui como falha.
 */
export async function guardApiKeyFailures(
  context: ExecutionContext,
  activate: () => Promise<boolean>,
  tracker: ApiKeyFailureTracker = apiKeyFailureTracker,
): Promise<boolean> {
  const req = context.switchToHttp().getRequest<ApiKeyRequest>();
  if (!req.headers[API_KEY_HEADER]) return activate();

  const ip = req.ip ?? '';
  if (tracker.isBlocked(ip)) {
    throw new HttpException(
      TOO_MANY_FAILURES_MESSAGE,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  try {
    return await activate();
  } catch (err) {
    if (err instanceof UnauthorizedException) tracker.recordFailure(ip);
    throw err;
  }
}
