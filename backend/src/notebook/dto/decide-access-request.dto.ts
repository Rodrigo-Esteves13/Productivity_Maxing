import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SHARE_ACCESS_ROLES = ['VIEWER', 'EDITOR', 'CO_OWNER'] as const;
export type ShareAccessRoleKind = (typeof SHARE_ACCESS_ROLES)[number];

export class DecideAccessRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsIn(['APPROVED', 'DENIED'])
  decision: 'APPROVED' | 'DENIED';

  @ApiPropertyOptional({
    enum: SHARE_ACCESS_ROLES,
    description:
      'Role given when approving: VIEWER reads, EDITOR proposes changes you approve or reject, CO_OWNER edits directly. Defaults to VIEWER (or keeps the current role).',
  })
  @IsOptional()
  @IsIn(SHARE_ACCESS_ROLES)
  role?: ShareAccessRoleKind;
}
