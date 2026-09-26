import { Module } from '@nestjs/common';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AccountStatusModule } from '../account-status/account-status.module';

@Module({
  // UsersModule só para reaproveitar UsersService.reactivateUser() no
  // approve (ver AppealsService.resolve) - precisa de exportar
  // UsersService (ver users.module.ts). AccountStatusModule para a
  // regra dos 3 appeals/cooldown (getAppealAvailability), partilhada com
  // AccountStatusController - ver o comentário lá. Sem ciclo: nem
  // UsersModule nem AccountStatusModule importam AppealsModule.
  imports: [PrismaModule, UsersModule, AccountStatusModule],
  controllers: [AppealsController],
  providers: [AppealsService],
})
export class AppealsModule {}
