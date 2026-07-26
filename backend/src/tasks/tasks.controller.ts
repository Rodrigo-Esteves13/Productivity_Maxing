import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ConfirmOverdueDto } from './dto/confirm-overdue.dto';
import { BulkTaskIdsDto } from './dto/bulk-task-ids.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Task')
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // taskTypes e academicTaskTypes já não são enum fixo, vêm da BD e são
  // editáveis pelos admins em /admin/task-types e /admin/academic-task-types.
  @Get('meta')
  getMetadata() {
    return this.tasksService.getMeta();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.id, dto);
  }

  @Get()
  // periodId: omitido = período ativo do user; 'all' = todos os períodos
  // (vista agregada, "Ver todos os períodos" no seletor); um UUID = esse
  // período específico (posse validada no service).
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string,
  ) {
    return this.tasksService.findAll(user.id, periodId);
  }

  @Get('today')
  findToday(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.findToday(user.id);
  }

  // Tasks fora de prazo, ainda por confirmar hoje - ver "why" no service.
  // Tem de vir antes de @Get(':id') para a rota literal não ser engolida
  // pelo parâmetro dinâmico.
  @Get('overdue-checkins')
  findPendingOverdueCheckins(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.findPendingOverdueCheckins(user.id);
  }

  // Mesma razão do overdue-checkins acima: rotas literais têm de vir
  // antes de @Get/@Patch/@Delete(':id'), senão "bulk-status"/"bulk-delete"
  // seriam interpretados como um :id.
  @Patch('bulk-status')
  bulkUpdateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkUpdateStatusDto,
  ) {
    return this.tasksService.bulkUpdateStatus(
      user.id,
      dto.ids,
      dto.progressStatus,
    );
  }

  @Post('bulk-delete')
  bulkRemove(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkTaskIdsDto,
  ) {
    return this.tasksService.bulkRemove(user.id, dto.ids);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.id, id, dto);
  }

  @Patch(':id/overdue-checkin')
  confirmOverdue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmOverdueDto,
  ) {
    return this.tasksService.confirmOverdue(user.id, id, dto.isCompleted);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.remove(user.id, id);
  }
}
