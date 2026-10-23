import {
  Body,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ACCESS_TOKEN_COOKIE } from '../auth/cookie.config';
import { THROTTLE_WINDOW_MS, perMinute } from '../common/throttle.util';
import { PadsService, type PadViewer } from './pads.service';
import { BlockPadSourceDto, PadSlugParamDto, SavePadDto } from './dto/pad.dto';
import { hashPadIp } from './pad-ip-hash.util';
import {
  ADMIN_PAD_DELETES_PER_MINUTE,
  PAD_ANON_WRITES_PER_MINUTE,
  PAD_LOCKS_PER_MINUTE,
  PAD_READS_PER_MINUTE,
  PAD_WRITES_PER_MINUTE,
} from './pads.constants';

// O ThrottlerGuard global corre antes do guard de auth desta rota, por isso
// decide pelo cookie de sessao (presenca), nao pelo utilizador validado. Um
// cookie falso so sobe o limite de pedidos; o limite de tamanho sem conta
// e aplicado no servico com o utilizador ja validado.
function writesPerMinute(context: ExecutionContext): number {
  const req = context.switchToHttp().getRequest<Request>();
  const cookies = req.cookies as Record<string, string | undefined>;
  return cookies?.[ACCESS_TOKEN_COOKIE]
    ? PAD_WRITES_PER_MINUTE
    : PAD_ANON_WRITES_PER_MINUTE;
}

function viewerOf(user: AuthenticatedUser | null, req: Request): PadViewer {
  return user
    ? { userId: user.id, ipHash: null }
    : { userId: null, ipHash: hashPadIp(req.ip) };
}

// Pads sao publicos (como o dontpad): ler e escrever sem conta. A sessao,
// quando existe, so da mais espaco, mais gravacoes por minuto e trancar.
@ApiTags('Pads')
@UseGuards(OptionalJwtAuthGuard)
@Controller('pads')
export class PadsController {
  constructor(private readonly pads: PadsService) {}

  // Rota literal antes de :slug.
  @Get('admin/recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Moderation: most recently changed pads with who saved them last (account or IP hash) (admin).',
  })
  listRecentForAdmin() {
    return this.pads.listRecentForAdmin();
  }

  @Post('admin/blocked-sources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Throttle(perMinute(ADMIN_PAD_DELETES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Moderation: stops an anonymous source (IP hash) from saving pads; reading still works (admin).',
  })
  blockSource(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BlockPadSourceDto,
    @Req() req: Request,
  ) {
    return this.pads.blockSourceAsAdmin(dto.ipHash, {
      adminId: user.id,
      ip: req.ip ?? '',
      method: req.method,
      path: req.originalUrl,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('admin/blocked-sources/:ipHash')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Throttle(perMinute(ADMIN_PAD_DELETES_PER_MINUTE))
  @ApiOperation({ summary: 'Moderation: lifts a source block (admin).' })
  unblockSource(@Param() params: BlockPadSourceDto) {
    return this.pads.unblockSourceAsAdmin(params.ipHash);
  }

  @Get(':slug')
  @Throttle(perMinute(PAD_READS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Reads a pad by name, with or without an account. A pad never saved reads as empty (version 0).',
  })
  get(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param() params: PadSlugParamDto,
    @Req() req: Request,
  ) {
    return this.pads.get(params.slug, viewerOf(user, req));
  }

  @Put(':slug')
  @Throttle({
    default: { limit: writesPerMinute, ttl: THROTTLE_WINDOW_MS },
  })
  @ApiOperation({
    summary:
      'Saves the full text of a pad, with or without an account (smaller limit without). 409 with the current pad when baseVersion is out of date; 403 when the pad is locked by another account.',
  })
  save(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param() params: PadSlugParamDto,
    @Body() dto: SavePadDto,
    @Req() req: Request,
  ) {
    return this.pads.save(viewerOf(user, req), params.slug, dto);
  }

  @Post(':slug/lock')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(PAD_LOCKS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Locks a pad: everyone can still read it, only your account can edit it (account required).',
  })
  lock(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: PadSlugParamDto,
  ) {
    return this.pads.lock(user.id, params.slug);
  }

  @Delete(':slug/lock')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(PAD_LOCKS_PER_MINUTE))
  @ApiOperation({
    summary: 'Unlocks a pad (the account that locked it, or an admin).',
  })
  unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: PadSlugParamDto,
  ) {
    return this.pads.unlock(user.id, params.slug, user.role === Role.ADMIN);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Throttle(perMinute(ADMIN_PAD_DELETES_PER_MINUTE))
  @ApiOperation({
    summary:
      'Moderation: deletes a pad and writes a security log entry (admin).',
  })
  removeAsAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: PadSlugParamDto,
    @Req() req: Request,
  ) {
    return this.pads.removeAsAdmin(params.slug, {
      adminId: user.id,
      ip: req.ip ?? '',
      method: req.method,
      path: req.originalUrl,
      userAgent: req.headers['user-agent'],
    });
  }
}
