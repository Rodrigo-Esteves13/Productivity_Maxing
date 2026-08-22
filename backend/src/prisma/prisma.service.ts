import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Prisma's default connection_limit, when the DATABASE_URL doesn't set one
// explicitly, is `num_physical_cpus * 2 + 1`. On Render's smaller
// instances (0.5-1 vCPU) that rounds down to a very small pool - every
// concurrent request beyond that count queues behind the ones already
// holding a connection, which shows up as "the app feels fine with one
// user open, but grinds under a few concurrent requests" (e.g. the task
// import in tasks.service.ts firing several creates at once, or just a
// couple of users loading the Dashboard's several parallel widget
// fetches at the same moment). Setting this explicitly, sized to the
// actual DB tier rather than to however many CPUs the web container
// happens to have, removes that single choke point.
//
// NOTE for Rodrigo: the schema.prisma comment says the runtime URL is the
// PgBouncer *transaction*-mode pooler on port 6543, but per what you told
// me earlier, DATABASE_URL was reverted to port 5432 *session* mode
// because transaction mode broke prepared statements - that comment in
// schema.prisma looks stale (harmless either way, comments don't affect
// runtime, only the actual env var does) but worth fixing so the next
// person reading it isn't misled. If DATABASE_URL is really direct
// session-mode Postgres (not pooled), DEFAULT_CONNECTION_LIMIT below is
// real physical Postgres connections - keep it comfortably under whatever
// your Supabase plan's max_connections is, with headroom for
// Studio/migrations/other clients.
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined; // let Prisma's own "DATABASE_URL missing" error fire, unchanged

  const url = new URL(raw);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set(
      'connection_limit',
      process.env.DB_CONNECTION_LIMIT ?? String(DEFAULT_CONNECTION_LIMIT),
    );
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set(
      'pool_timeout',
      process.env.DB_POOL_TIMEOUT_SECONDS ??
        String(DEFAULT_POOL_TIMEOUT_SECONDS),
    );
  }
  return url.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = buildDatasourceUrl();
    super(datasourceUrl ? { datasourceUrl } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
    // Visible in Render logs at boot - confirms which pool size actually
    // took effect (env override vs the default above) without having to
    // go digging through env vars to check.
    const effectiveLimit =
      process.env.DB_CONNECTION_LIMIT ?? String(DEFAULT_CONNECTION_LIMIT);
    this.logger.log(
      `Connected to database (connection_limit=${effectiveLimit})`,
    );
  }

  // Sem isto, o Nest nunca fecha a ligação ao desligar (watch mode local a
  // reiniciar, ou o Render a fazer deploy) - as ligações antigas ficavam
  // penduradas no pooler até expirarem sozinhas por timeout, contribuindo
  // para esgotar o limite de ligações simultâneas do pooler em modo
  // "session". Ver main.ts: app.enableShutdownHooks() é o que garante que
  // este hook é mesmo chamado.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
