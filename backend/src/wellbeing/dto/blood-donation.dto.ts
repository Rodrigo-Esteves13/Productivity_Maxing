import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodDonationType } from '@prisma/client';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_BLOOD_DONATION_LOCATION_LENGTH,
  MAX_BLOOD_DONATION_NOTE_LENGTH,
} from '../wellbeing.constants';
import { IsRealDateKey } from '../../common/validators/is-real-date-key.decorator';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class UpdateBloodDonationDto {
  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @IsRealDateKey()
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date?: string;

  @ApiPropertyOptional({ enum: BloodDonationType })
  @IsOptional()
  @IsEnum(BloodDonationType)
  type?: BloodDonationType;

  // Texto vazio apaga o campo (null); omitido deixa como esta.
  @ApiPropertyOptional({ example: 'IPST Porto' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BLOOD_DONATION_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BLOOD_DONATION_NOTE_LENGTH)
  note?: string;
}

export class CreateBloodDonationDto {
  @ApiProperty({ example: '2026-10-20' })
  @IsRealDateKey()
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date: string;

  @ApiPropertyOptional({ enum: BloodDonationType })
  @IsOptional()
  @IsEnum(BloodDonationType)
  type?: BloodDonationType;

  @ApiPropertyOptional({ example: 'IPST Porto' })
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(MAX_BLOOD_DONATION_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(MAX_BLOOD_DONATION_NOTE_LENGTH)
  note?: string;
}
