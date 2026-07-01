import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';

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
    PrismaModule,
    AreasModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    //O Guard global entra aqui para proteger todas as rotas automaticamente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
