import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WellbeingModule } from '../wellbeing/wellbeing.module';
import { PadsModule } from '../pads/pads.module';
import { PersonalNotesModule } from '../personal-notes/personal-notes.module';
import { CourseRiskModule } from '../course-risk/course-risk.module';
import { AccountAnniversaryRemindersService } from './account-anniversary-reminders.service';
import { GradeAlmostThereRemindersService } from './grade-almost-there-reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { AbsenceLimitRemindersService } from './absence-limit-reminders.service';
import { StreakRiskRemindersService } from './streak-risk-reminders.service';
import { DueTodayRemindersService } from './due-today-reminders.service';
import { MoneyRemindersService } from './money-reminders.service';
import { BudgetAlertRemindersService } from './budget-alert-reminders.service';
import { MonthlyDigestService } from './monthly-digest.service';
import { MedicationReminderSchedulerService } from './medication-reminder-scheduler.service';
import { SentNotificationService } from './sent-notification.service';

@Module({
  imports: [
    MailModule,
    PushModule,
    WellbeingModule,
    PadsModule,
    PersonalNotesModule,
    CourseRiskModule,
  ],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    AbsenceLimitRemindersService,
    StreakRiskRemindersService,
    GradeAlmostThereRemindersService,
    AccountAnniversaryRemindersService,
    DueTodayRemindersService,
    MoneyRemindersService,
    BudgetAlertRemindersService,
    MonthlyDigestService,
    MedicationReminderSchedulerService,
    SentNotificationService,
  ],
})
export class RemindersModule {}
