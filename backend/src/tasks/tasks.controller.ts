import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TaskType, Difficulty } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Task')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('meta')
  getMetadata() {
    return {
      taskTypes: Object.values(TaskType),
      difficulties: Object.values(Difficulty),
    };
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTaskDto) {
    // Segurança máxima: Procura pelo id ou pelo sub!
    const userId = user.id || user.sub;
    if (!userId) throw new UnauthorizedException('ID do utilizador não encontrado no token.');
    
    return this.tasksService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    const userId = user.id || user.sub;
    return this.tasksService.findAll(userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user.id || user.sub;
    return this.tasksService.findOne(userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    const userId = user.id || user.sub;
    return this.tasksService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user.id || user.sub;
    return this.tasksService.remove(userId, id);
  }
}