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
import { TaskPacksService } from './task-packs.service';
import { TaskPackSyncService } from './task-pack-sync.service';
import { CreateTaskPackDto, ImportTaskPackDto } from './dto/task-pack.dto';
import { perMinute } from '../common/throttle.util';

@ApiTags('Task packs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-packs')
export class TaskPacksController {
  constructor(
    private readonly packs: TaskPacksService,
    private readonly sync: TaskPackSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Task packs you created.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.packs.list(user.id);
  }

  @Post()
  @Throttle(perMinute(10))
  @ApiOperation({
    summary: 'Creates a shareable pack from some of YOUR tasks.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskPackDto,
  ) {
    return this.packs.create(user.id, dto);
  }

  // Literais (`updates`) antes de qualquer `:id` do mesmo verbo.
  @Get('updates')
  @ApiOperation({
    summary: 'Pending changes to tasks you imported from packs.',
  })
  listUpdates(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.listPending(user.id);
  }

  @Post('updates/:updateId/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(30))
  @ApiOperation({ summary: 'Applies a pack change to your task.' })
  acceptUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ) {
    return this.sync.accept(user.id, updateId);
  }

  @Post('updates/:updateId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(30))
  @ApiOperation({ summary: 'Keeps your version of the task.' })
  async rejectUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ): Promise<void> {
    await this.sync.reject(user.id, updateId);
  }

  // As rotas com `code/` ficam antes das de `:id` por clareza; o código é um
  // segredo não adivinhável (96 bits) e o throttle trava tentativas em massa.
  @Get('code/:code')
  @Throttle(perMinute(30))
  @ApiOperation({ summary: 'Preview of a pack someone shared with you.' })
  preview(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.packs.preview(user.id, code);
  }

  @Post('code/:code/import')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({
    summary: 'Creates the chosen tasks of a pack in your account.',
  })
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: ImportTaskPackDto,
  ) {
    return this.packs.import(user.id, code, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({
    summary:
      'Sends the changes you made to the source tasks to everyone who imported the pack. They must approve each one.',
  })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sync.publish(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a pack (its link stops working).' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.packs.remove(user.id, id);
  }
}
