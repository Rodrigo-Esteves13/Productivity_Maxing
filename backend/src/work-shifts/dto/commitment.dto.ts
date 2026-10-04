import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_BUFFER_MINUTES, MAX_LABEL_LENGTH } from '../work-shifts.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCommitmentDto {
  @ApiProperty({ example: 'Work' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  name: string;

  @ApiProperty({ example: 25, description: 'Travel minutes each way.' })
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  commuteMinutes: number;
}

export class UpdateCommitmentDto {
  @ApiPropertyOptional({ example: 'Work' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  commuteMinutes?: number;
}
