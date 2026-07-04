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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  // User profile
  @Get(':id')
  @ApiOperation({ summary: "Gets a user's data by ID" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // All external accounts (providers) for a user
  @Get(':id/providers')
  @ApiOperation({
    summary: 'Gets all external accounts linked to the user',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  getProviders(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getProviders(id);
  }

  // A specific external account for a user
  @Get(':id/providers/:provider')
  @ApiOperation({
    summary: 'Gets data for a specific provider (e.g. google, github)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({
    name: 'provider',
    description: 'Provider name',
    example: 'github',
  })
  getProviderAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('provider') provider: 'google' | 'github' | 'discord',
  ) {
    return this.usersService.getProviderAccount(id, provider);
  }
}
