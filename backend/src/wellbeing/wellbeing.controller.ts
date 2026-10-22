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
import {
  DateKeyParamDto,
  MoodRangeQueryDto,
  UpsertMoodDto,
} from './dto/mood.dto';
import {
  CreateMedicationDto,
  MedicationDayQueryDto,
  MedicationDoseDto,
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
