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
import { Role, ApiKeyScope } from '@prisma/client';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireApiKeyScope } from '../auth/decorators/require-api-key-scope.decorator';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiKeyScopeGuard } from '../auth/guards/api-key-scope.guard';

// A GESTÃO (criar/editar/apagar) é exclusiva de ADMIN - ver os guards em
// cada rota abaixo. A LEITURA (findAll/findOne) não pode ter a mesma
// restrição: a página /tasks (qualquer utilizador, não só admin) usa
// GET /areas para preencher o dropdown de Area ao criar/editar uma task
// (ver useTasksPage.ts no frontend) - torná-la ADMIN-only quebrava a
// criação de tasks para toda a gente. Exigimos, no mínimo, sessão válida:
// antes desta correção estas duas rotas estavam completamente públicas
// (nem sequer exigiam login), o que expunha o catálogo de áreas a
// qualquer pedido não autenticado sem necessidade nenhuma.
//
// JwtOrApiKeyAuthGuard (em vez de JwtAuthGuard sozinho) porque isto é o
// catálogo GLOBAL de Areas, partilhado por todos os users - as rotas de
// escrita ganham também ApiKeyScopeGuard(ADMIN): RolesGuard já confirma
// que o USER é admin, isto confirma adicionalmente que, SE a autenticação
// veio de uma API Key, essa key foi explicitamente gerada com scope
// ADMIN (não basta o user ser admin - a key tem de o ser também).

@ApiTags('Area')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Creates a new life area (Admin only)' })
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  @UseGuards(JwtOrApiKeyAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary: 'Lists the global catalog of areas (any authenticated user)',
  })
  findAll() {
    return this.areasService.findAll();
  }

  @UseGuards(JwtOrApiKeyAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.findOne(id);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areasService.update(id, updateAreaDto);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.remove(id);
  }
}

