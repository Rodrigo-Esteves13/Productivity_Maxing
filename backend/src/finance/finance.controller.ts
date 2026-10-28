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
import { FinanceService } from './finance.service';
import {
  CreateFinanceEntryDto,
  CreateFinanceGoalDto,
  UpdateFinanceGoalDto,
  UpdateFinanceSettingsDto,
} from './dto/finance.dto';
import { FINANCE_WRITES_PER_MINUTE } from './finance.constants';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @ApiOperation({
    summary: 'Balance, entries and totals of a month (YYYY-MM), plus goals.',
  })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    return this.finance.summary(user.id, month ?? '');
  }

  @Put('settings')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Sets currency, balance and monthly limits.' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFinanceSettingsDto,
  ) {
    return this.finance.updateSettings(user.id, dto);
  }

  @Post('entries')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Adds an income or an expense.' })
  createEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinanceEntryDto,
  ) {
    return this.finance.createEntry(user.id, dto);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes an income or an expense.' })
  removeEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeEntry(user.id, id);
  }

  @Post('goals')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Adds a savings, investment, wishlist or long-term goal.',
  })
  createGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinanceGoalDto,
  ) {
    return this.finance.createGoal(user.id, dto);
  }

  @Patch('goals/:id')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Edits a goal or how much is already saved.' })
  updateGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceGoalDto,
  ) {
    return this.finance.updateGoal(user.id, id, dto);
  }

  @Delete('goals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a goal.' })
  removeGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeGoal(user.id, id);
  }
}
