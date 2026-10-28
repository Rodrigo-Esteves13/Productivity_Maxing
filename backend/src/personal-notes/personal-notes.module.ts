import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { PersonalNotesController } from './personal-notes.controller';
import { PersonalNotesService } from './personal-notes.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  controllers: [PersonalNotesController],
  providers: [PersonalNotesService],
  // RemindersModule envia os lembretes no mesmo cron.
  exports: [PersonalNotesService],
})
export class PersonalNotesModule {}
