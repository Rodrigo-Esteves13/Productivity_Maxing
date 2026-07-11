import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskTypesModule } from './task-types/task-types.module';
import { PrismaModule } from './prisma/prisma.module';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { SecurityLogsModule } from './security-logs/security-logs.module';
import { StudySessionsModule } from './study-sessions/study-sessions.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { RequestUserLoggerInterceptor } from './common/interceptors/request-user-logger.interceptor';

@Module({
  imports: [
    // 100 pedidos por minuto
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    UsersModule,
    TasksModule,
    TaskTypesModule,
    PrismaModule,
    AreasModule,
    AuthModule,
    HealthModule,
    SecurityLogsModule,
    StudySessionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // O Guard global entra aqui para proteger todas as rotas automaticamente.
    // LoggingThrottlerGuard é um ThrottlerGuard normal (mesmos limites,
    // mesmo comportamento) que só acrescenta: grava um SecurityLog sempre
    // que bloqueia um pedido - ver common/guards/logging-throttler.guard.ts
    // e a página /admin/security-logs no frontend.
    {
      provide: APP_GUARD,
      useClass: LoggingThrottlerGuard,
    },
    // Segundo Guard global: valida CSRF (double-submit cookie) em todos os
    // pedidos que alteram estado e que usam sessão por cookie.
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    // Interceptor global: escreve no terminal, para cada pedido, qual
    // utilizador autenticado o fez (ou "anónimo"). Corre depois dos Guards,
    // por isso já vê req.user preenchido pelo JwtStrategy nas rotas
    // protegidas.
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestUserLoggerInterceptor,
    },
  ],
})
export class AppModule {}
