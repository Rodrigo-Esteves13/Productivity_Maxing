import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import type { Express } from 'express';
import { getFrontendUrl } from './config/app.config';
import { JsonLogger } from './common/logger/json-logger.service';
import { isMaintenanceMode } from './common/guards/maintenance.guard';

// Variáveis obrigatórias para o backend funcionar com segurança. Se
// qualquer uma faltar, a app não deve arrancar silenciosamente com um
// fallback fraco (ex: JWT_SECRET vazia) - isto teria de facto acontecido
// antes desta correção, e um erro de configuração no Render passaria
// despercebido até alguém explorar a falha.
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'API_KEY_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Cifra os accessToken/refreshToken OAuth (Google/GitHub/Discord) antes
  // de irem para a tabela Identity - ver auth/crypto/token-cipher.ts.
  // Gera um valor com: openssl rand -base64 32
  'TOKEN_ENCRYPTION_KEY',
  // Sem estas, as Strategies OAuth (ver auth/strategies/*.ts) arrancavam
  // silenciosamente com clientSecret === '' em vez de falhar alto - um
  // provider mal configurado no Render passava despercebido até alguém
  // tentar fazer login com esse provider e falhar de forma confusa.
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_SECRET',
  'DISCORD_CLIENT_SECRET',
] as const;

function assertRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

async function bootstrap() {
  assertRequiredEnvVars();

  const app = await NestFactory.create(AppModule);
  app.useLogger(new JsonLogger());

  // Em produção corremos atrás do proxy do Render (e a firewall dele já
  // filtra a maior parte do lixo antes de chegar cá). Sem isto, req.ip
  // seria sempre o IP interno do proxy, não o do cliente real - o que
  // partia tanto o ThrottlerGuard (contava tudo como se fosse um único
  // IP, ou bloqueava toda a gente ao mesmo tempo) como os SecurityLog
  // gravados a cada bloqueio (ver LoggingThrottlerGuard), que ficavam
  // todos com o mesmo IP inútil. "1" = confia só no primeiro hop do
  // X-Forwarded-For (o proxy do Render), não numa cadeia arbitrária.
  const httpAdapter = app.getHttpAdapter().getInstance() as Express;
  httpAdapter.set('trust proxy', 1);

  // Sem isto, o Nest NUNCA chama onModuleDestroy() nos providers (ex:
  // PrismaService.$disconnect() - ver prisma.service.ts) quando o
  // processo recebe SIGTERM (docker compose a reiniciar por causa do
  // watch mode, ou o Render a fazer deploy). As ligações à BD ficavam
  // penduradas no pooler até expirarem sozinhas por timeout - com poucos
  // restarts seguidos, isso já chegava para esgotar o limite de 15
  // ligações do pooler em modo "session" (EMAXCONNSESSION).
  app.enableShutdownHooks();

  app.use(helmet());
  // Necessário para o JwtStrategy e o CsrfGuard conseguirem ler
  // req.cookies - sem isto, req.cookies fica sempre undefined.
  app.use(cookieParser());

  app.enableCors({
    origin: getFrontendUrl(),
    credentials: true,
  });

  // Uma só instância do ValidationPipe (a duplicada anterior, sem
  // forbidNonWhitelisted/transform, era inofensiva mas redundante e
  // confusa - ficava sempre sobreposta por esta).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';

  if (isMaintenanceMode()) {
    // MaintenanceGuard (global, see app.module.ts) is what actually
    // enforces this on every request past this point - this is just a
    // startup breadcrumb so "why is everything 503ing" isn't a mystery
    // the first time someone checks the deploy logs.
    new JsonLogger().warn(
      'MAINTENANCE_MODE is enabled - all non-/health requests will 503.',
      'Bootstrap',
    );
  }

  // Swagger só em não-produção: em prod dá a qualquer visitante o mapa
  // completo de rotas e DTOs da API de graça, sem necessidade nenhuma.
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Productivity Maxing API')
      .setDescription('A API profissional para gerir Areas e Tasks')
      .setVersion('1.0')
      .addTag('User')
      .addTag('Area')
      .addTag('Task')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // O NestJS arranca na porta 3000
  await app.listen(3000);
}
void bootstrap();
