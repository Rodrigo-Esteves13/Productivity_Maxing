import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WellbeingModule } from '../wellbeing/wellbeing.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MailModule, PushModule, WellbeingModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
