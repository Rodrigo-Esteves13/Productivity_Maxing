import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushCoreModule } from './push-core.module';
import { PushController } from './push.controller';

// O PushService vive no PushCoreModule (uma so instancia, partilhada com o
// AuthModule); este modulo so junta o controller e reexporta o servico para
// quem ja importava o PushModule.
@Module({
  imports: [PrismaModule, AuthModule, PushCoreModule],
  controllers: [PushController],
  exports: [PushCoreModule],
})
export class PushModule {}
