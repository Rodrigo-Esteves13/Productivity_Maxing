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
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// A GESTÃO (criar/editar/apagar) é exclusiva de ADMIN - ver os guards em
// cada rota abaixo. A LEITURA (findAll/findOne) não pode ter a mesma
// restrição: a página /tasks (qualquer utilizador, não só admin) usa
// GET /areas para preencher o dropdown de Area ao criar/editar uma task
// (ver useTasksPage.ts no frontend) - torná-la ADMIN-only quebrava a
// criação de tasks para toda a gente. Exigimos, no mínimo, sessão válida:
// antes desta correção estas duas rotas estavam completamente públicas
// (nem sequer exigiam login), o que expunha o catálogo de áreas a
// qualquer pedido não autenticado sem necessidade nenhuma.

@ApiTags('Area')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Creates a new life area (Admin only)' })
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary: 'Lists the global catalog of areas (any authenticated user)',
  })
  findAll() {
    return this.areasService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areasService.update(id, updateAreaDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.remove(id);
  }
}
