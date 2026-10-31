import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WellbeingModule } from '../wellbeing/wellbeing.module';
import { PadsModule } from '../pads/pads.module';
import { PersonalNotesModule } from '../personal-notes/personal-notes.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { AbsenceLimitRemindersService } from './absence-limit-reminders.service';

@Module({
  imports: [
    MailModule,
    PushModule,
    WellbeingModule,
    PadsModule,
    PersonalNotesModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, AbsenceLimitRemindersService],
})
export class RemindersModule {}
