import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { ArchivePeriodDto } from './dto/archive-period.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('AcademicPeriod')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  @ApiOperation({
    summary: 'Creates a period (semester/year) inside a program',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePeriodDto) {
    return this.periodsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Renames a period and/or edits its dates. Does not touch isArchived - use /archive or /restore for that.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePeriodDto,
  ) {
    return this.periodsService.update(user.id, id, dto);
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary:
      "Archives a period (soft-delete). Returns 409 if it is the program's most recent period with no successor - retry with { confirm: true } to force it. Returns 400 if it is the user's only remaining active period anywhere.",
  })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ArchivePeriodDto,
  ) {
    return this.periodsService.archive(user.id, id, dto?.confirm);
  }

  @Patch(':id/restore')
  @ApiOperation({
    summary: 'Restores an archived period (undoes archive, no restrictions)',
  })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.periodsService.restore(user.id, id);
  }

  @Patch(':id/pin')
  @ApiOperation({
    summary:
      'Toggles pinning this period as the one its program auto-selects, instead of always defaulting to the most recent. Pinning one unpins any other pinned period in the same program.',
  })
  togglePin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.periodsService.togglePin(user.id, id);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary:
      "Sets this period (and its program) as the user's active dashboard",
  })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.periodsService.setActive(user.id, id);
  }

  @Get(':id/average')
  @ApiOperation({
    summary: 'Weighted average of the graded tasks in this period only',
  })
  getAverage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.periodsService.getAverage(user.id, id);
  }
}
