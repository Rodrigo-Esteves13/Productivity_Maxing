import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskTypesModule } from './task-types/task-types.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { SecurityLogsModule } from './security-logs/security-logs.module';
import { StudySessionsModule } from './study-sessions/study-sessions.module';
import { CalendarModule } from './calendar/calendar.module';
import { AgentModule } from './agent/agent.module';
import { AcademicProgramsModule } from './academic-programs/academic-programs.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { PredictionModule } from './prediction/prediction.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
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
    CalendarModule,
    AgentModule,
    AcademicProgramsModule,
    TelemetryModule,
    PredictionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Runs first (registration order = execution order for APP_GUARD):
    // when MAINTENANCE_MODE is on, every request short-circuits here with
    // a 503 before it can even hit the throttler or CSRF check below - no
    // reason to count a maintenance-window request against anyone's rate
    // limit, or to require a CSRF token nobody can obtain from a page
    // that never rendered.
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
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
