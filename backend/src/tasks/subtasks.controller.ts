import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { SubtasksService } from './subtasks.service';
import { TasksService } from './tasks.service';
import {
  CreateSubtaskDto,
  CreateSubtasksBulkDto,
  ReorderSubtasksDto,
  UpdateSubtaskDto,
} from './dto/subtask.dto';

@ApiTags('Subtask')
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyAuthGuard)
@Controller('tasks/:taskId/subtasks')
export class SubtasksController {
  constructor(
    private readonly subtasksService: SubtasksService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.subtasksService.list(user.id, taskId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.subtasksService.create(user.id, taskId, dto.title);
  }

  // Rotas literais ("bulk", "reorder") antes de ":subtaskId" - mesma razão
  // do resto do projeto, senão seriam lidas como um id.
  @Post('bulk')
  createBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtasksBulkDto,
  ) {
    return this.subtasksService.createMany(user.id, taskId, dto.titles);
  }

  @Patch('reorder')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: ReorderSubtasksDto,
  ) {
    return this.subtasksService.reorder(user.id, taskId, dto.subtaskIds);
  }

  // Passo -> task própria (ver TasksService.createFromSubtask).
  @Post(':subtaskId/convert')
  convertToTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.tasksService.createFromSubtask(user.id, taskId, subtaskId);
  }

  @Patch(':subtaskId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.subtasksService.update(user.id, taskId, subtaskId, dto);
  }

  @Delete(':subtaskId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    await this.subtasksService.remove(user.id, taskId, subtaskId);
  }
}
