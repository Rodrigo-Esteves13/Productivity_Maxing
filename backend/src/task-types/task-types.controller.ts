import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskTypesService } from './task-types.service';
import { CreateTaskTypeDto } from './dto/create-task-type.dto';
import { UpdateTaskTypeDto } from './dto/update-task-type.dto';
import { CreateAcademicTaskTypeDto } from './dto/create-academic-task-type.dto';
import { UpdateAcademicTaskTypeDto } from './dto/update-academic-task-type.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Nota: a listagem "para uso normal" (só os ativos) já é servida por GET /tasks/meta.
// Este controller serve só para o ADMIN gerir (ver tudo incl. inativos, criar, editar, desativar).
@ApiTags('TaskTypes (Admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller()
export class TaskTypesController {
  constructor(private readonly taskTypesService: TaskTypesService) {}

  // ---------- TaskType ----------

  @Get('admin/task-types')
  @ApiOperation({
    summary:
      'Lista todos os tipos de tarefa, incluindo inativos (Apenas ADMIN)',
  })
  findAllTaskTypes() {
    return this.taskTypesService.findAllTaskTypes(false);
  }

  @Post('admin/task-types')
  @ApiOperation({ summary: 'Cria um novo tipo de tarefa (Apenas ADMIN)' })
  createTaskType(@Body() dto: CreateTaskTypeDto) {
    return this.taskTypesService.createTaskType(dto);
  }

  @Patch('admin/task-types/:id')
  @ApiOperation({
    summary: 'Edita label/cor/ordem/ativo de um tipo de tarefa (Apenas ADMIN)',
  })
  updateTaskType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskTypeDto,
  ) {
    return this.taskTypesService.updateTaskType(id, dto);
  }

  @Delete('admin/task-types/:id')
  @ApiOperation({
    summary: 'Desativa um tipo de tarefa, sem apagar (Apenas ADMIN)',
  })
  removeTaskType(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskTypesService.removeTaskType(id);
  }

  // ---------- AcademicTaskType ----------

  @Get('admin/academic-task-types')
  @ApiOperation({
    summary:
      'Lists all academic subcategories, including inactive ones (Admin only)',
  })
  findAllAcademicTaskTypes() {
    return this.taskTypesService.findAllAcademicTaskTypes(false);
  }

  @Post('admin/academic-task-types')
  @ApiOperation({
    summary: 'Creates a new academic subcategory (Admin only)',
  })
  createAcademicTaskType(@Body() dto: CreateAcademicTaskTypeDto) {
    return this.taskTypesService.createAcademicTaskType(dto);
  }

  @Patch('admin/academic-task-types/:id')
  @ApiOperation({ summary: 'Edits an academic subcategory (Admin only)' })
  updateAcademicTaskType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicTaskTypeDto,
  ) {
    return this.taskTypesService.updateAcademicTaskType(id, dto);
  }

  @Delete('admin/academic-task-types/:id')
  @ApiOperation({
    summary:
      'Deactivates an academic subcategory, without deleting it (Admin only)',
  })
  removeAcademicTaskType(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskTypesService.removeAcademicTaskType(id);
  }
}
