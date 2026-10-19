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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CommitmentsService } from './commitments.service';
import {
  CreateCommitmentDto,
  EstimateCommitmentCommuteDto,
  UpdateCommitmentDto,
} from './dto/commitment.dto';
import { perMinute } from '../common/throttle.util';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commitments')
export class CommitmentsController {
  constructor(private readonly commitmentsService: CommitmentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Commitments (e.g. workplaces) with their shifts, plus ungrouped shifts.',
  })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.commitmentsService.overview(user.id);
  }

  @Post()
  @Throttle(perMinute(20))
  @ApiOperation({ summary: 'Creates a commitment with its own commute time.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommitmentDto,
  ) {
    return this.commitmentsService.create(user.id, dto);
  }

  @Patch(':id')
  @Throttle(perMinute(30))
  @ApiOperation({
    summary: 'Edits the name or commute time of a commitment you own.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitmentDto,
  ) {
    return this.commitmentsService.update(user.id, id, dto);
  }

  @Post('commute/estimate')
  @HttpCode(HttpStatus.OK)
  // Cada chamada gasta quota da Google Maps: limite apertado por utilizador.
  @Throttle(perMinute(10))
  @ApiOperation({
    summary:
      'Estimates travel time from your home address to a place (does not save anything).',
  })
  estimateCommute(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EstimateCommitmentCommuteDto,
  ) {
    return this.commitmentsService.estimateCommute(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a commitment and all its shifts.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commitmentsService.remove(user.id, id);
  }
}
