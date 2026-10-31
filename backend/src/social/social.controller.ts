import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { FriendCodeRequestsService } from './friend-code-requests.service';
import {
  FriendLinksService,
  type FriendLink,
  type FriendLinkPreview,
} from './friend-links.service';
import {
  SocialService,
  type CodeChangeRequestView,
  type SendRequestResult,
  type SocialOverview,
  type SocialPendingCounts,
} from './social.service';
import {
  BlockUserDto,
  FriendCodeChangeRequestDto,
  SendFriendRequestDto,
  ClassmateFriendRequestDto,
  EmailFriendRequestDto,
  FriendLinkDto,
  SocialSettingsDto,
} from './dto/social.dto';
import { perMinute } from '../common/throttle.util';

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly codeRequests: FriendCodeRequestsService,
    private readonly links: FriendLinksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Your friend code, friends, pending requests and blocks.',
  })
  overview(@CurrentUser() user: AuthenticatedUser): Promise<SocialOverview> {
    return this.social.overview(user.id);
  }

  @Get('pending')
  @ApiOperation({
    summary:
      'How many friend requests, note invitations and notes requests wait for you.',
  })
  pending(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SocialPendingCounts> {
    return this.social.pendingCounts(user.id);
  }

  @Patch('settings')
  @ApiOperation({
    summary:
      'Whether people who know your email can send you a friend request.',
  })
  settings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SocialSettingsDto,
  ) {
    return this.links.setAllowEmailRequests(
      user.id,
      dto.allowEmailFriendRequests,
    );
  }

  @Get('friend-link')
  @Throttle(perMinute(10))
  @ApiOperation({
    summary:
      'A signed link with your friend code, valid 7 days: whoever opens it and accepts becomes your friend straight away.',
  })
  friendLink(@CurrentUser() user: AuthenticatedUser): Promise<FriendLink> {
    return this.links.create(user.id);
  }

  // Throttle apertado: sem ele dava para testar codigos as cegas.
  @Get('friend-link/preview')
  @Throttle(perMinute(20))
  @ApiOperation({
    summary: 'Who a friend link belongs to and whether accepting is instant.',
  })
  previewLink(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: FriendLinkDto,
  ): Promise<FriendLinkPreview> {
    return this.links.preview(user.id, dto.friendCode, dto.expires, dto.token);
  }

  @Post('friend-link/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({
    summary:
      'Accepts a friend link: friends at once while the link is signed and valid, otherwise a normal request.',
  })
  acceptLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FriendLinkDto,
  ): Promise<SendRequestResult> {
    return this.links.accept(user.id, dto.friendCode, dto.expires, dto.token);
  }

  @Post('friend-code/change-request')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  @ApiOperation({
    summary: 'Ask an admin to change your friend code (a reason is required).',
  })
  requestCodeChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FriendCodeChangeRequestDto,
  ): Promise<CodeChangeRequestView> {
    return this.codeRequests.create(user.id, dto.reason);
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({
    summary: "Send a friend request using the other person's friend code.",
  })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendFriendRequestDto,
  ): Promise<SendRequestResult> {
    return this.social.sendRequest(user.id, dto.friendCode);
  }

  // Antes de requests/:id/accept: caminho literal no mesmo verbo. A
  // resposta e sempre a mesma, exista a conta ou nao.
  @Post('requests/email')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  @ApiOperation({
    summary:
      'Send a friend request to whoever has this email. Always answers the same, so it never reveals who has an account.',
  })
  sendByEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EmailFriendRequestDto,
  ): Promise<{ status: 'SENT' }> {
    return this.links.requestByEmail(user.id, dto.email);
  }

  // Antes de requests/:id/accept: caminho literal no mesmo verbo.
  @Post('requests/classmate')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiOperation({
    summary: 'Send a friend request to someone in a class you are both in.',
  })
  sendToClassmate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClassmateFriendRequestDto,
  ): Promise<SendRequestResult> {
    return this.social.sendRequestToClassmate(user.id, dto.turmaId, dto.userId);
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.social.accept(user.id, id);
  }

  // Recusar, cancelar pedido enviado ou remover amigo.
  @Delete('friendships/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.social.remove(user.id, id);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(20))
  block(@CurrentUser() user: AuthenticatedUser, @Body() dto: BlockUserDto) {
    return this.social.block(user.id, dto.userId);
  }

  @Delete('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.social.unblock(user.id, userId);
  }
}
