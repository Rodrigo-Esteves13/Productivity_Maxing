import {
  Controller,
  ForbiddenException,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// Só o próprio dono da conta ou um ADMIN pode ver o perfil detalhado /
// as identidades OAuth de um utilizador. UUIDs não são segredo (aparecem
// no path público do avatar), por isso isto NUNCA pode depender só de
// "quem sabe o ID".
function assertSelfOrAdmin(me: AuthenticatedUser, targetId: string): void {
  if (me.id !== targetId && me.role !== Role.ADMIN) {
    throw new ForbiddenException(
      'You do not have permission to access this resource.',
    );
  }
}


@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // List all users -> ADMIN ONLY!
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard) // Attach the route guard
  @Roles(Role.ADMIN) // Requires the ADMIN role
  @ApiBearerAuth() // Shows the lock icon in Swagger
  @ApiOperation({
    summary: 'Gets the list of all users (Admin only)',
  })
  findAll() {
    return this.usersService.findAll();
  }

  // User profile - só o próprio dono ou um ADMIN. Antes desta correção,
  // esta rota estava completamente aberta e devolvia o User inteiro
  // (incluindo supabaseAuthId) a qualquer pedido não autenticado.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gets a user's data by ID (self or admin only)" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  findOne(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertSelfOrAdmin(me, id);
    return this.usersService.findOne(id);
  }

  // All external accounts (providers) for a user. Antes desta correção,
  // esta rota devolvia accessToken/refreshToken em texto plano dos
  // providers OAuth (Google/GitHub/Discord) sem autenticação nenhuma.
  @Get(':id/providers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Gets which external accounts are linked to the user (self or admin only)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  getProviders(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertSelfOrAdmin(me, id);
    return this.usersService.getProviders(id);
  }

  // A specific external account for a user - mesma correção.
  @Get(':id/providers/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Gets whether a specific provider (e.g. google, github) is linked (self or admin only)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({
    name: 'provider',
    description: 'Provider name',
    example: 'github',
  })
  getProviderAccount(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('provider') provider: 'google' | 'github' | 'discord',
  ) {
    assertSelfOrAdmin(me, id);
    return this.usersService.getProviderAccount(id, provider);
  }
}
