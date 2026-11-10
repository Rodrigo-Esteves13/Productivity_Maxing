import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { CreateStreakFreezeDto } from './dto/create-streak-freeze.dto';
import {
  StreakFreezesService,
  type StreakFreezeRow,
  type StreakFreezeStatus,
} from './streak-freezes.service';
import {
  STREAK_FREEZE_READS_PER_MINUTE,
  STREAK_FREEZE_WRITES_PER_MINUTE,
} from './streak-freeze.constants';

// Privado ao user: so le/escreve os seus proprios dias de descanso.
@ApiTags('Focus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('streak-freezes')
export class StreakFreezesController {
  constructor(private readonly service: StreakFreezesService) {}

  @Get()
  @Throttle(perMinute(STREAK_FREEZE_READS_PER_MINUTE))
  @ApiOperation({
    summary: 'Your recent study streak rest days and whether today can be one.',
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<StreakFreezeStatus> {
    return this.service.status(user.id);
  }

  @Post()
  @Throttle(perMinute(STREAK_FREEZE_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Claims a rest day (today or yesterday) that bridges the study streak.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStreakFreezeDto,
  ): Promise<StreakFreezeRow> {
    return this.service.create(user.id, dto.dateKey);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(STREAK_FREEZE_WRITES_PER_MINUTE))
  @ApiOperation({ summary: "Undoes today's rest day." })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }
}
