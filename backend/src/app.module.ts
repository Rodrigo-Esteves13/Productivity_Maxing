import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskTypesModule } from './task-types/task-types.module';
import { PrioritiesModule } from './priorities/priorities.module';
import { PrismaModule } from './prisma/prisma.module';
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
import { ScheduleModule } from './schedule/schedule.module';
import { RemindersModule } from './reminders/reminders.module';
import { StudyPlanModule } from './study-plan/study-plan.module';
import { WorkShiftsModule } from './work-shifts/work-shifts.module';
import { NotebookModule } from './notebook/notebook.module';
import { PushModule } from './push/push.module';
import { FeedbackModule } from './feedback/feedback.module';
import { TaskPacksModule } from './task-packs/task-packs.module';
import { SocialModule } from './social/social.module';
import { GradeComponentsModule } from './grade-components/grade-components.module';
import { ApprovalRulesModule } from './approval-rules/approval-rules.module';
import { AreaInterestsModule } from './area-interests/area-interests.module';
import { AreaTeachersModule } from './area-teachers/area-teachers.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { AreaRatingsModule } from './area-ratings/area-ratings.module';
import { CourseRiskModule } from './course-risk/course-risk.module';
import { BannedIpsModule } from './banned-ips/banned-ips.module';
import { AppealsModule } from './appeals/appeals.module';
import { WellbeingModule } from './wellbeing/wellbeing.module';
import { PersonalNotesModule } from './personal-notes/personal-notes.module';
import { FinanceModule } from './finance/finance.module';
import { PadsModule } from './pads/pads.module';
import { TurmasModule } from './turmas/turmas.module';
import { BannedIpGuard } from './common/guards/banned-ip.guard';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import {
  DEFAULT_REQUESTS_PER_MINUTE,
  THROTTLE_WINDOW_MS,
} from './common/throttle.util';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { RequestUserLoggerInterceptor } from './common/interceptors/request-user-logger.interceptor';

@Module({
  imports: [
    // 100 pedidos por minuto
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_WINDOW_MS,
        limit: DEFAULT_REQUESTS_PER_MINUTE,
      },
    ]),
    UsersModule,
    TasksModule,
    TaskTypesModule,
    PrioritiesModule,
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
    ScheduleModule,
    RemindersModule,
    StudyPlanModule,
    WorkShiftsModule,
    NotebookModule,
    PushModule,
    FeedbackModule,
    TaskPacksModule,
    SocialModule,
    GradeComponentsModule,
    ApprovalRulesModule,
    AreaInterestsModule,
    AreaTeachersModule,
    FlashcardsModule,
    AreaRatingsModule,
    CourseRiskModule,
    BannedIpsModule,
    AppealsModule,
    WellbeingModule,
    PadsModule,
    TurmasModule,
    PersonalNotesModule,
    FinanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Primeiro de todos: um IP banido nem sequer deve saber que a app está
    // em manutenção, ou receber um 429 do throttler - só um 403 seco, o
    // mais cedo possível no pipeline. Ver common/guards/banned-ip.guard.ts.
    {
      provide: APP_GUARD,
      useClass: BannedIpGuard,
    },
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
