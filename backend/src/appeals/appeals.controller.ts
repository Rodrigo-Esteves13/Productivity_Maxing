import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AppealsService } from './appeals.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';
import { QueryAppealsDto } from './dto/query-appeals.dto';
import { JwtBlockedAwareGuard } from '../auth/guards/jwt-blocked-aware-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Appeals')
@Controller('appeals')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  // A própria conta está SUSPENDED/BANNED aqui - JwtAuthGuard normal já
  // rejeitaria isto com 401 antes de chegar cá (ver JwtStrategy). Este é
  // um dos dois ÚNICOS endpoints de toda a app que usam
  // JwtBlockedAwareGuard - ver o comentário completo em
  // jwt-blocked-aware.strategy.ts sobre o que isto nunca deve proteger.
  @Post()
  @UseGuards(JwtBlockedAwareGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submits an appeal against the current suspension/ban',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAppealDto) {
    return this.appealsService.create(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lists appeals (Admin only), paginated' })
  findAll(@Query() query: QueryAppealsDto) {
    return this.appealsService.findAll(query);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approves or denies an appeal (Admin only)' })
  @ApiParam({ name: 'id', description: 'Appeal UUID' })
  resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.appealsService.resolve(admin.id, id, dto);
  }
}
