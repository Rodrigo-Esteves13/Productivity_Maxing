import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Role, ApiKeyScope } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { RejectAreaProposalDto } from './dto/reject-area-proposal.dto';
import { SetAreaHiddenDto } from './dto/set-area-hidden.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireApiKeyScope } from '../auth/decorators/require-api-key-scope.decorator';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ApiKeyScopeGuard } from '../auth/guards/api-key-scope.guard';
import { perMinute } from '../common/throttle.util';

// Modelo de Areas:
// - OFICIAIS (ownerId = null): catálogo global, geridas só por ADMIN.
// - PRIVADAS (ownerId = user): cada user cria e gere as suas; ninguém mais
//   as vê. Uma privada pode ser PROPOSTA e um admin aprova (passa a
//   oficial) ou recusa (fica privada, com o motivo).
//
// Segurança:
// - Leitura: o service filtra SEMPRE por "oficial OU minha".
// - Escrita por users (criar/editar/apagar/propor): JwtAuthGuard (sessão
//   real + CSRF), nunca API key - uma key de scripts não deve mexer no
//   catálogo pessoal sem querer.
// - Rotas de admin: Roles(ADMIN) + ApiKeyScope(ADMIN), como antes.
// - ATENÇÃO à ordem: rotas estáticas (official, proposals) ANTES de ':id',
//   senão o ParseUUIDPipe do ':id' apanhava-as e devolvia 400.

@ApiTags('Area')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(20))
  @Post()
  @ApiOperation({ summary: 'Creates a PERSONAL (private) area for the caller' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createAreaDto: CreateAreaDto,
  ) {
    return this.areasService.create(user.id, createAreaDto);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Post('official')
  @ApiOperation({ summary: 'Creates an OFFICIAL area (Admin only)' })
  createOfficial(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createAreaDto: CreateAreaDto,
  ) {
    return this.areasService.createOfficial(user.id, createAreaDto);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Get('proposals')
  @ApiOperation({ summary: 'Lists areas waiting to become official (Admin)' })
  listProposals() {
    return this.areasService.listProposals();
  }

  // Estática: tem de vir antes de ':id/...'.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(20))
  @Put('visibility')
  @ApiOperation({ summary: 'Turns ALL official areas on/off for the caller' })
  setAllHidden(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetAreaHiddenDto,
  ) {
    return this.areasService.setAllOfficialHidden(user.id, dto.hidden);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(60))
  @Put(':id/visibility')
  @ApiOperation({ summary: 'Turns one official area on/off for the caller' })
  setHidden(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAreaHiddenDto,
  ) {
    return this.areasService.setHidden(user.id, id, dto.hidden);
  }

  @UseGuards(JwtOrApiKeyAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary:
      "Lists the official areas plus the caller's own personal areas. Optional periodId annotates each area with usedInPeriod (has a task of the caller in that period) - used by the Notebook to group 'this period' first without ever hiding a subject.",
  })
  @ApiQuery({ name: 'periodId', required: false })
  @ApiQuery({
    name: 'includeHidden',
    required: false,
    description:
      'true = also returns official areas the caller turned off (Areas page)',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string,
    @Query('includeHidden') includeHidden?: string,
  ) {
    return this.areasService.findAll(
      user.id,
      periodId,
      includeHidden === 'true',
    );
  }

  @UseGuards(JwtOrApiKeyAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.areasService.findOne(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(30))
  @Patch(':id')
  @ApiOperation({
    summary: 'Edits a personal area (owner) or an official one (Admin)',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areasService.update(user, id, updateAreaDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(30))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deletes a personal area (owner) or an official one (Admin)',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.areasService.remove(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(10))
  @Post(':id/propose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Proposes your personal area to become official' })
  propose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.areasService.propose(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(10))
  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraws a pending proposal' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.areasService.withdraw(user.id, id);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approves a proposal: the area becomes official' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.areasService.approve(user.id, id);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @ApiBearerAuth()
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejects a proposal (stays private to its owner)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAreaProposalDto,
  ) {
    return this.areasService.reject(id, dto.note);
  }
}
