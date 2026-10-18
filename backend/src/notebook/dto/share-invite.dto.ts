import { IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SHARE_ACCESS_ROLES,
  type ShareAccessRoleKind,
} from './decide-access-request.dto';

export class InviteFriendDto {
  @ApiProperty({ description: 'userId of an accepted friend.' })
  @IsUUID()
  friendId: string;

  @ApiProperty({ enum: SHARE_ACCESS_ROLES })
  @IsIn(SHARE_ACCESS_ROLES)
  role: ShareAccessRoleKind;
}

export class RespondInviteDto {
  @ApiProperty()
  @IsIn([true, false])
  accept: boolean;
}
