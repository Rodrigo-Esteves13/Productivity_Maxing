import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { WellbeingController } from './wellbeing.controller';
import { MedicationDoseActionController } from './medication-dose-action.controller';
import { MedicationDoseActionTokenService } from './medication-dose-action.token';
import { MoodService } from './mood.service';
import { WellbeingInsightsService } from './wellbeing-insights.service';
import { MedicationsService } from './medications.service';
import { MedicationIntakesService } from './medication-intakes.service';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import { MedicationHistoryService } from './medication-history.service';
import { BloodDonationsService } from './blood-donations.service';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  // Rota literal POST wellbeing/medications/dose-action registada primeiro.
  controllers: [MedicationDoseActionController, WellbeingController],
  providers: [
    MedicationDoseActionTokenService,
    MoodService,
    WellbeingInsightsService,
    MedicationsService,
    MedicationIntakesService,
    MedicationDisclaimerService,
    MedicationHistoryService,
    BloodDonationsService,
  ],
  // RemindersModule chama os lembretes de medicacao no mesmo cron.
  exports: [MedicationsService],
})
export class WellbeingModule {}
