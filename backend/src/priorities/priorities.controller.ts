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
import { PrioritiesService } from './priorities.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Nota: a listagem "para uso normal" (só as ativas) já é servida por
// GET /tasks/meta. Este controller serve só para o ADMIN gerir (ver tudo
// incl. inativas, criar, editar, desativar) - mesmo padrão do
// TaskTypesController.
@ApiTags('Priorities (Admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller('admin/priorities')
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lists all priorities, including inactive ones (Admin only)',
  })
  findAll() {
    return this.prioritiesService.findAll(false);
  }

  @Post()
  @ApiOperation({ summary: 'Creates a new priority level (Admin only)' })
  create(@Body() dto: CreatePriorityDto) {
    return this.prioritiesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edits label/color/order/active status of a priority (Admin only)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriorityDto,
  ) {
    return this.prioritiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivates a priority, without deleting it (Admin only)',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prioritiesService.remove(id);
  }
}
