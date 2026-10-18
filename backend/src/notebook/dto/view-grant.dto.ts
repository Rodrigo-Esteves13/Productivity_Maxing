import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestViewGrantDto {
  @ApiProperty({ description: 'The friend whose notes you want to read.' })
  @IsUUID()
  ownerId: string;
}

export class DecideViewGrantDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Areas (subjects) the person may read. Required when approving.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  areaIds?: string[];
}

export class UpdateViewGrantAreasDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  areaIds: string[];
}
