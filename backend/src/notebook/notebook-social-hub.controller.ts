import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  NotebookSocialHubService,
  type FriendHub,
  type MyShare,
} from './notebook-social-hub.service';

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotebookSocialHubController {
  constructor(private readonly hub: NotebookSocialHubService) {}

  @Get('social/friends/:userId')
  @ApiOperation({
    summary:
      'Everything you share with one friend, both ways (notes, notebook access).',
  })
  friend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<FriendHub> {
    return this.hub.friendHub(user.id, userId);
  }

  @Get('notebook/shares/mine')
  @ApiOperation({
    summary:
      'Your shared notes, with how many people see each and what waits for you.',
  })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<MyShare[]> {
    return this.hub.myShares(user.id);
  }
}
