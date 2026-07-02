import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Listar todos os utilizadores -> APENAS ADMIN!
  @Get()
  @UseGuards(RolesGuard) // Liga o Guardião da rota
  @Roles(Role.ADMIN) // Exige o papel de ADMIN
  @ApiBearerAuth() // Mostra o cadeado no Swagger
  @ApiOperation({
    summary: 'Obtém a lista de todos os utilizadores (Apenas Admin)',
  })
  findAll() {
    return this.usersService.findAll();
  }

  // Perfil do utilizador
  @Get(':id')
  @ApiOperation({ summary: 'Obtém os dados de um utilizador pelo ID' })
  @ApiParam({ name: 'id', description: 'UUID do utilizador' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // Todas as contas externas (providers) de um utilizador
  @Get(':id/providers')
  @ApiOperation({
    summary: 'Obtém todas as contas externas ligadas ao utilizador',
  })
  @ApiParam({ name: 'id', description: 'UUID do utilizador' })
  getProviders(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getProviders(id);
  }

  // Uma conta externa específica de um utilizador
  @Get(':id/providers/:provider')
  @ApiOperation({
    summary: 'Obtém os dados de um provider específico (ex: google, github)',
  })
  @ApiParam({ name: 'id', description: 'UUID do utilizador' })
  @ApiParam({
    name: 'provider',
    description: 'Nome do provider',
    example: 'github',
  })
  getProviderAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('provider') provider: 'google' | 'github' | 'discord',
  ) {
    return this.usersService.getProviderAccount(id, provider);
  }
}
