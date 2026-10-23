import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PAD_MAX_CONTENT_LENGTH,
  PAD_SLUG_MAX_LENGTH,
  PAD_SLUG_PATTERN,
} from '../pads.constants';

export class PadSlugParamDto {
  @ApiProperty({ example: 'fisica-1a' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @MaxLength(PAD_SLUG_MAX_LENGTH)
  @Matches(PAD_SLUG_PATTERN)
  slug: string;
}

export class SavePadDto {
  @ApiProperty({ description: 'Full text of the pad.' })
  @IsString()
  @MaxLength(PAD_MAX_CONTENT_LENGTH)
  content: string;

  @ApiProperty({
    example: 3,
    description:
      'Version the client last loaded (0 for a pad that does not exist yet). A different current version returns 409 with the latest pad.',
  })
  @IsInt()
  @Min(0)
  baseVersion: number;
}

export class BlockPadSourceDto {
  @ApiProperty({ description: 'IP hash shown in the pad moderation list.' })
  @IsString()
  @Matches(/^[a-f0-9]{32}$/)
  ipHash: string;
}
