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
  CreateFinanceAccountDto,
  CreateFinanceEntryDto,
  CreateFinanceGoalDto,
  CreateFinanceHoldingDto,
  FinanceAnalyticsQueryDto,
  UpdateFinanceAccountDto,
  UpdateFinanceEntryDto,
  UpdateFinanceGoalDto,
  UpdateFinanceHoldingDto,
  UpdateFinanceSettingsDto,
} from './dto/finance.dto';
import {
  FINANCE_REFRESH_PER_MINUTE,
  FINANCE_WRITES_PER_MINUTE,
} from './finance.constants';

// Contrato para o frontend: finance.contract.ts.

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @ApiOperation({
    summary:
      'Balances, accounts, holdings, entries, scheduled occurrences and totals of a month (YYYY-MM), plus goals.',
  })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    return this.finance.summary(user.id, month ?? '');
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      'Income/expense series per week or month, top categories, subscriptions and end-of-month projection.',
  })
  analytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceAnalyticsQueryDto,
  ) {
    return this.finance.analytics(user.id, query);
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

  @Patch('entries/:id')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Edits an entry, its recurrence or its end date.',
  })
  updateEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceEntryDto,
  ) {
    return this.finance.updateEntry(user.id, id, dto);
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

  @Post('accounts')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Adds an account (bank, live money, broker...).' })
  createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinanceAccountDto,
  ) {
    return this.finance.createAccount(user.id, dto);
  }

  @Patch('accounts/:id')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Edits an account or its balance.' })
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.finance.updateAccount(user.id, id, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes an account (entries and holdings stay).' })
  removeAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeAccount(user.id, id);
  }

  // Literal antes de qualquer rota holdings/:id.
  @Post('holdings/refresh')
  @Throttle(perMinute(FINANCE_REFRESH_PER_MINUTE))
  @ApiOperation({
    summary:
      'Refreshes prices of your holdings (each symbol at most every few minutes).',
  })
  refreshHoldings(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.refreshPrices(user.id);
  }

  @Post('holdings')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Adds a holding by quantity or by invested amount.',
  })
  createHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinanceHoldingDto,
  ) {
    return this.finance.createHolding(user.id, dto);
  }

  @Patch('holdings/:id')
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Edits a holding.' })
  updateHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceHoldingDto,
  ) {
    return this.finance.updateHolding(user.id, id, dto);
  }

  @Delete('holdings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(FINANCE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Deletes a holding.' })
  removeHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeHolding(user.id, id);
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
