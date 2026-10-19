import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotebookInviteService } from './notebook-invite.service';
import { InviteFriendDto, RespondInviteDto } from './dto/share-invite.dto';
import { perMinute } from '../common/throttle.util';

// Convites de amigos para UMA nota (editor / co-owner / leitor). Controller
// a parte: rotas com sessao obrigatoria, ao contrario de /notebook/shared/:token.
@ApiTags('Notebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notebook')
export class NotebookInviteController {
  constructor(private readonly invites: NotebookInviteService) {}

  @Post('entries/:id/share/invite')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({ summary: 'Invite a friend to this note with a role.' })
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteFriendDto,
  ) {
    return this.invites.invite(user.id, id, dto.friendId, dto.role);
  }

  @Delete('entries/:id/share/access/:requestId')
  @Throttle(perMinute(30))
  @ApiOperation({ summary: 'Remove someone’s access (or cancel an invite).' })
  removeAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.invites.removeAccess(user.id, id, requestId);
  }

  @Post('invitations/:requestId/respond')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(20))
  @ApiOperation({ summary: 'Accept or decline an invitation to a note.' })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RespondInviteDto,
  ) {
    return this.invites.respond(user.id, requestId, dto.accept);
  }
}
