import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { MoodService } from './mood.service';
import { WellbeingInsightsService } from './wellbeing-insights.service';
import { MedicationsService } from './medications.service';
import { MedicationIntakesService } from './medication-intakes.service';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import { MedicationHistoryService } from './medication-history.service';
import { BloodDonationsService } from './blood-donations.service';
import { CreateBloodDonationDto } from './dto/blood-donation.dto';
import {
  DateKeyParamDto,
  MoodRangeQueryDto,
  UpsertMoodDto,
} from './dto/mood.dto';
import {
  AcceptMedicationDisclaimerDto,
  CreateMedicationDto,
  CreateMedicationIntakeDto,
  MedicationDayQueryDto,
  MedicationIntakeRangeQueryDto,
  MedicationDoseDto,
  MedicationHistoryQueryDto,
  UpdateMedicationDto,
} from './dto/medication.dto';

const WRITES_PER_MINUTE = 30;
const INSIGHTS_PER_MINUTE = 20;

@ApiTags('Wellbeing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wellbeing')
export class WellbeingController {
  constructor(
    private readonly mood: MoodService,
    private readonly insights: WellbeingInsightsService,
    private readonly medications: MedicationsService,
    private readonly intakes: MedicationIntakesService,
    private readonly disclaimer: MedicationDisclaimerService,
    private readonly history: MedicationHistoryService,
    private readonly bloodDonations: BloodDonationsService,
  ) {}

  @Get('mood')
  @ApiOperation({
    summary: 'Daily mood check-ins between two dates (inclusive).',
  })
  listMood(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MoodRangeQueryDto,
  ) {
    return this.mood.list(user.id, query);
  }

  @Put('mood/:date')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Saves the mood check-in for one day (one per day).',
  })
  upsertMood(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DateKeyParamDto,
    @Body() dto: UpsertMoodDto,
  ) {
    return this.mood.upsert(user.id, params.date, dto);
  }

  @Delete('mood/:date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes the mood check-in for one day.' })
  removeMood(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DateKeyParamDto,
  ) {
    return this.mood.remove(user.id, params.date);
  }

  @Get('insights')
  @Throttle(perMinute(INSIGHTS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Correlations between your mood, energy, stress and study focus over the last 90 days. Says "not enough data" instead of guessing.',
  })
  getInsights(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.get(user.id);
  }

  @Get('medications')
  @ApiOperation({ summary: 'Lists your medications.' })
  listMedications(@CurrentUser() user: AuthenticatedUser) {
    return this.medications.list(user.id);
  }

  // Rota literal declarada antes das rotas com :id no mesmo verbo.
  @Get('medications/day')
  @ApiOperation({ summary: 'Dose checklist for one day (default today).' })
  medicationDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MedicationDayQueryDto,
  ) {
    return this.medications.day(user.id, query.date);
  }

  @Get('medications/history')
  @ApiOperation({
    summary:
      'Doses planned vs taken per day and per medication, plus "as needed" counts, between two dates (up to 92 days).',
  })
  medicationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MedicationHistoryQueryDto,
  ) {
    return this.history.get(user.id, query.from, query.to);
  }

  @Get('blood-donations')
  @ApiOperation({ summary: 'Your recorded blood donations, newest first.' })
  listBloodDonations(@CurrentUser() user: AuthenticatedUser) {
    return this.bloodDonations.list(user.id);
  }

  @Post('blood-donations')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Records one blood donation.' })
  createBloodDonation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBloodDonationDto,
  ) {
    return this.bloodDonations.create(user.id, dto);
  }

  @Delete('blood-donations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes one recorded blood donation.' })
  removeBloodDonation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bloodDonations.remove(user.id, id);
  }

  @Get('medications/disclaimer')
  @ApiOperation({
    summary:
      'Whether you accepted the current version of the medication notice.',
  })
  disclaimerStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.disclaimer.status(user.id);
  }

  @Post('medications/disclaimer')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Accepts the medication notice (not medical advice, reminders only). Required before adding medication or logging intakes.',
  })
  acceptDisclaimer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptMedicationDisclaimerDto,
  ) {
    return this.disclaimer.accept(user.id, dto.version, dto.locale);
  }

  @Get('medications/intakes')
  @ApiOperation({
    summary: 'Your "as needed" intakes between two dates (inclusive).',
  })
  listIntakes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MedicationIntakeRangeQueryDto,
  ) {
    return this.intakes.list(user.id, query);
  }

  @Post('medications/intakes')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Logs one "as needed" intake.',
  })
  createIntake(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicationIntakeDto,
  ) {
    return this.intakes.create(user.id, dto);
  }

  @Delete('medications/intakes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes one logged intake.' })
  removeIntake(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.intakes.remove(user.id, id);
  }

  @Post('medications')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Adds a medication with daily reminder times.' })
  createMedication(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicationDto,
  ) {
    return this.medications.create(user.id, dto);
  }

  @Patch('medications/:id')
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Updates a medication.' })
  updateMedication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medications.update(user.id, id, dto);
  }

  @Delete('medications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a medication and its dose history.' })
  removeMedication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.medications.remove(user.id, id);
  }

  @Put('medications/:id/doses')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Marks one dose as taken or not taken.' })
  setDose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MedicationDoseDto,
  ) {
    return this.medications.setDose(user.id, id, dto);
  }
}
