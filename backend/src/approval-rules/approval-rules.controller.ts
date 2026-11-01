import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { ApprovalRulesService } from './approval-rules.service';
import { UpsertApprovalRulesDto } from './dto/upsert-approval-rules.dto';

// Escritas sao raras (configurar uma vez por programa/cadeira).
const WRITE_LIMIT_PER_MINUTE = 30;

// Rotas so com segmentos literais + :id; 'presets' vem antes de tudo.
@ApiTags('Approval rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approval-rules')
export class ApprovalRulesController {
  constructor(private readonly service: ApprovalRulesService) {}

  @Get('presets')
  @ApiOperation({ summary: 'Built-in approval rule presets.' })
  presets() {
    return this.service.listPresets();
  }

  @Get('programs/:programId')
  @ApiOperation({
    summary: 'Approval rules of a program (generic preset if none saved).',
  })
  getForProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    return this.service.getForProgram(user.id, programId);
  }

  @Put('programs/:programId')
  @Throttle(perMinute(WRITE_LIMIT_PER_MINUTE))
  @ApiOperation({ summary: 'Creates or replaces the rules of a program.' })
  upsertForProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: UpsertApprovalRulesDto,
  ) {
    return this.service.upsertForProgram(user.id, programId, dto);
  }

  @Delete('programs/:programId')
  @Throttle(perMinute(WRITE_LIMIT_PER_MINUTE))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Removes the rules of a program (back to generic).',
  })
  async removeForProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ): Promise<void> {
    await this.service.removeForProgram(user.id, programId);
  }

  // Literal antes das rotas com :areaId.
  @Put('areas')
  @Throttle(perMinute(WRITE_LIMIT_PER_MINUTE))
  @ApiOperation({
    summary: 'Applies the same rules to every course of the user at once.',
  })
  upsertForAllAreas(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertApprovalRulesDto,
  ) {
    return this.service.upsertForAllAreas(user.id, dto);
  }

  @Get('areas/:areaId')
  @ApiOperation({
    summary:
      'Effective rules of a course (override > program > generic) and their source.',
  })
  getForArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.service.getForArea(user.id, areaId);
  }

  @Put('areas/:areaId')
  @Throttle(perMinute(WRITE_LIMIT_PER_MINUTE))
  @ApiOperation({
    summary: 'Creates or replaces the rule override of a course.',
  })
  upsertForArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UpsertApprovalRulesDto,
  ) {
    return this.service.upsertForArea(user.id, areaId, dto);
  }

  @Delete('areas/:areaId')
  @Throttle(perMinute(WRITE_LIMIT_PER_MINUTE))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Removes the override of a course.' })
  async removeForArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<void> {
    await this.service.removeForArea(user.id, areaId);
  }
}
