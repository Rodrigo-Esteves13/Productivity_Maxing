import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MailModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
