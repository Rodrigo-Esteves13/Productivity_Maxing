import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

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
] as const;

function assertRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias em falta: ${missing.join(', ')}`,
    );
  }
}

async function bootstrap() {
  assertRequiredEnvVars();

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  // Necessário para o JwtStrategy e o CsrfGuard conseguirem ler
  // req.cookies - sem isto, req.cookies fica sempre undefined.
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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
