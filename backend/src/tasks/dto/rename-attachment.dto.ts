import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ATTACHMENT_NAME_MAX_LENGTH } from '../../notebook/attachment-validation.util';

export class RenameAttachmentDto {
  @ApiProperty({ example: 'Assignment brief' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ATTACHMENT_NAME_MAX_LENGTH)
  name: string;
}
