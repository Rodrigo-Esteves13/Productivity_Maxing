import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Delete,
  Body,
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
import { UpdateUserDto } from './dto/update-user.dto';
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

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Exports all data for the authenticated user in JSON format (GDPR)',
  })
  async exportMyData(@CurrentUser() user: AuthenticatedUser) {
    // Agora o "user" tem garantia absoluta de existir graças ao JwtAuthGuard
    return this.usersService.exportUserData(user.id);
  }

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

  // Export "portabilidade dos dados" (self ou admin) - mesma regra de
  // acesso que o resto: só o próprio dono ou um ADMIN.
  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Exports a user's full data as JSON (self or admin only)",
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  exportData(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertSelfOrAdmin(me, id);
    return this.usersService.exportUserData(id);
  }

  // Update de outro utilizador (nome e/ou role) -> ADMIN ONLY.
  // Bloqueado explicitamente: um admin não pode usar esta rota para se
  // despromover a si próprio - isso podia deixar a plataforma sem nenhum
  // admin ativo se fosse o último. Para mudar o PRÓPRIO nome, o fluxo
  // correto continua a ser PATCH /auth/me.
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Updates a user's name/role (Admin only)" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (me.id === id && dto.role !== undefined && dto.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You cannot change your own role. Ask another admin to do it.',
      );
    }
    return this.usersService.update(id, dto);
  }

  // Apaga outro utilizador -> ADMIN ONLY. Bloqueado explicitamente para a
  // própria conta - para isso já existe DELETE /auth/me, que trata da
  // sessão (limpa os cookies) de forma que esta rota não tem como fazer.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deletes a user account (Admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async remove(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (me.id === id) {
      throw new ForbiddenException(
        'You cannot delete your own account from here. Use "Delete account" in your Profile instead.',
      );
    }
    await this.usersService.remove(id);
    return { message: 'User deleted.' };
  }
}
