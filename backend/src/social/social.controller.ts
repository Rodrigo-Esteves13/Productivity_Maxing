import {
  Body,
  Controller,
  Delete,
  Get,
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
import { FriendCodeRequestsService } from './friend-code-requests.service';
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
