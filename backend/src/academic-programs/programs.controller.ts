import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { PeriodsService } from './periods.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// Programas são dados do PRÓPRIO user, mesmo perfil de risco que Tasks/
// Periods - ver a nota equivalente em periods.controller.ts.
@ApiTags('AcademicProgram')
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyAuthGuard)
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly programsService: ProgramsService,
    private readonly periodsService: PeriodsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Lists the authenticated user's programs/dashboards",
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.programsService.findAllForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Creates a new program/dashboard' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProgramDto,
  ) {
    return this.programsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edits a program (name, order, gradeScale) or archives it (isActive: false)',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Permanently deletes a program. Returns 409 if the program still has any task in it (any period, archived or not) - move or delete those tasks first.',
  })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.programsService.remove(user.id, id);
  }

  @Get(':id/periods')
  @ApiOperation({ summary: 'Lists the periods of a program' })
  findPeriods(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.periodsService.findAllForProgram(user.id, id);
  }

  @Get(':id/average')
  @ApiOperation({
    summary:
      'Cumulative weighted average of all graded tasks in the program (all periods, archived included)',
  })
  getAverage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.programsService.getAverage(user.id, id);
  }

  @Get(':id/credits')
  @ApiOperation({
    summary:
      'ECTS (or equivalent) credits accumulated so far: sum of Area.credits for every passed Area, across all periods',
  })
  getCreditsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.programsService.getCreditsSummary(user.id, id);
  }

  @Get(':id/periods-comparison')
  @ApiOperation({
    summary:
      'Average per period within this program, for comparison (never cross-program)',
  })
  getPeriodsComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.programsService.getPeriodsComparison(user.id, id);
  }
}
