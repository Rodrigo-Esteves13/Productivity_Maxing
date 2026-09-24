import { Module } from '@nestjs/common';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  // UsersModule só para reaproveitar UsersService.reactivateUser() no
  // approve (ver AppealsService.resolve) - precisa de exportar
  // UsersService (ver users.module.ts).
  imports: [PrismaModule, UsersModule],
  controllers: [AppealsController],
  providers: [AppealsService],
})
export class AppealsModule {}
