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
import { TaskPacksService } from './task-packs.service';
import { TaskPackSyncService } from './task-pack-sync.service';
import { TaskPackItemsService } from './task-pack-items.service';
import {
  AddPackItemsDto,
  CreateTaskPackDto,
  ImportTaskPackDto,
  RenameTaskPackDto,
  UpdatePackItemDto,
} from './dto/task-pack.dto';
import { perMinute } from '../common/throttle.util';
import {
  PACK_CODE_IMPORT_PER_MINUTE,
  PACK_CODE_PREVIEW_PER_MINUTE,
  PACK_ITEM_WRITES_PER_MINUTE,
  PACK_PUBLISH_PER_MINUTE,
  PACK_UPDATE_DECISIONS_PER_MINUTE,
  PACK_WRITES_PER_MINUTE,
} from './task-packs.constants';

@ApiTags('Task packs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-packs')
export class TaskPacksController {
  constructor(
    private readonly packs: TaskPacksService,
    private readonly sync: TaskPackSyncService,
    private readonly items: TaskPackItemsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Task packs you created.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.packs.list(user.id);
  }

  @Post()
  @Throttle(perMinute(PACK_WRITES_PER_MINUTE))
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
  @Throttle(perMinute(PACK_UPDATE_DECISIONS_PER_MINUTE))
  @ApiOperation({ summary: 'Applies a pack change to your task.' })
  acceptUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ) {
    return this.sync.accept(user.id, updateId);
  }

  @Post('updates/:updateId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(PACK_UPDATE_DECISIONS_PER_MINUTE))
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
  @Throttle(perMinute(PACK_CODE_PREVIEW_PER_MINUTE))
  @ApiOperation({ summary: 'Preview of a pack someone shared with you.' })
  preview(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.packs.preview(user.id, code);
  }

  @Post('code/:code/import')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(PACK_CODE_IMPORT_PER_MINUTE))
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
  @Throttle(perMinute(PACK_PUBLISH_PER_MINUTE))
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

  @Get(':id/items')
  @ApiOperation({ summary: 'Tasks inside one of your packs.' })
  listItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.items.list(user.id, id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(PACK_ITEM_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Adds some of YOUR tasks to a pack (same link).' })
  addItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPackItemsDto,
  ) {
    return this.items.add(user.id, id, dto);
  }

  @Patch(':id/items/:itemId')
  @Throttle(perMinute(PACK_ITEM_WRITES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Edits one task of a pack (and your source task). Importers must approve the change.',
  })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePackItemDto,
  ) {
    return this.items.update(user.id, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @Throttle(perMinute(PACK_ITEM_WRITES_PER_MINUTE))
  @ApiOperation({
    summary: 'Removes one task from a pack. Imported tasks are not deleted.',
  })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.items.remove(user.id, id, itemId);
  }

  @Patch(':id')
  @Throttle(perMinute(PACK_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Renames a pack (link and tasks stay the same).' })
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameTaskPackDto,
  ) {
    return this.packs.rename(user.id, id, dto);
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
