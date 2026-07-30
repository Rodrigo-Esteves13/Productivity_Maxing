import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProgramDto {
  @ApiProperty({
    example: "Bachelor's in Computer Science",
    description: 'Program/dashboard name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: '0-20',
    description: 'Grade scale used in this program',
    default: '0-20',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gradeScale?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order in the program selector',
  })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Default for whether the final (credit-weighted) average is rounded to the nearest whole number. Periods can override this individually.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  roundFinalGrade?: boolean;
}
