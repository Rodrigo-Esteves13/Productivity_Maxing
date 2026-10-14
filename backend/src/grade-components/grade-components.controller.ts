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
import { IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GradeComponentsService } from './grade-components.service';
import {
  CreateGradeComponentDto,
  UpdateGradeComponentDto,
} from './dto/grade-component.dto';
import {
  CreateGradeEntryDto,
  UpdateGradeEntryDto,
} from './dto/grade-entry.dto';

class ListGradeComponentsQuery {
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;
}

@ApiTags('Grade components')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('grade-components')
export class GradeComponentsController {
  constructor(private readonly service: GradeComponentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Grade components (weekly seminars, participation...) with their grades.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGradeComponentsQuery,
  ) {
    return this.service.list(user.id, query);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Creates a grade component for a course and period.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGradeComponentDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Edits name, weight or rule of a component.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeComponentDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a component and all its grades.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }

  @Post(':id/entries')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Adds a grade (e.g. one seminar) to a component.' })
  addEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGradeEntryDto,
  ) {
    return this.service.addEntry(user.id, id, dto);
  }

  @Patch(':id/entries/:entryId')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Edits one grade of a component.' })
  updateEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateGradeEntryDto,
  ) {
    return this.service.updateEntry(user.id, id, entryId, dto);
  }

  @Delete(':id/entries/:entryId')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Removes one grade from a component.' })
  removeEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.service.removeEntry(user.id, id, entryId);
  }
}
