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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { WorkShiftsService } from './work-shifts.service';
import { CreateWorkShiftsDto } from './dto/create-work-shifts.dto';
import { UpdateWorkShiftDto } from './dto/update-work-shift.dto';
import { WorkShiftRangeQueryDto } from './dto/work-shift-range.query.dto';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('work-shifts')
export class WorkShiftsController {
  constructor(private readonly workShiftsService: WorkShiftsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lists all stored work shifts (weekly and one-off).',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workShiftsService.list(user.id);
  }

  // Rota literal declarada antes de qualquer rota com :id no mesmo verbo.
  @Get('range')
  @ApiOperation({
    summary:
      'Work shifts expanded to concrete days between two dates (inclusive, max 62 days).',
  })
  range(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WorkShiftRangeQueryDto,
  ) {
    return this.workShiftsService.expandRange(user.id, query.from, query.to);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Creates up to 31 work shifts atomically (all or none).',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkShiftsDto,
  ) {
    return this.workShiftsService.createMany(user.id, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Edits one work shift owned by the caller.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkShiftDto,
  ) {
    return this.workShiftsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes one work shift owned by the caller.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.workShiftsService.remove(user.id, id);
  }
}
