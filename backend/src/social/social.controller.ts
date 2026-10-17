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
import {
  SocialService,
  type SendRequestResult,
  type SocialOverview,
} from './social.service';
import { BlockUserDto, SendFriendRequestDto } from './dto/social.dto';

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @ApiOperation({
    summary: 'Your friend code, friends, pending requests and blocks.',
  })
  overview(@CurrentUser() user: AuthenticatedUser): Promise<SocialOverview> {
    return this.social.overview(user.id);
  }

  @Post('friend-code/regenerate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async regenerate(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ friendCode: string }> {
    return { friendCode: await this.social.regenerateFriendCode(user.id) };
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: "Send a friend request using the other person's friend code.",
  })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendFriendRequestDto,
  ): Promise<SendRequestResult> {
    return this.social.sendRequest(user.id, dto.friendCode);
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
