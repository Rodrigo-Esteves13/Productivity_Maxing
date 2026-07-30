import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePeriodDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID of the AcademicProgram this period belongs to',
  })
  @IsString()
  @IsNotEmpty()
  programId: string;

  @ApiProperty({
    example: 'Fall Semester 2024/25',
    description: 'Period name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: '2024-09-01T00:00:00Z',
    description: 'Period start date (ISO)',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: '2025-01-31T00:00:00Z',
    description: 'Period end date (ISO), optional while it is ongoing',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: null,
    description:
      'Overrides the program default for rounding the final average. true/false to override, null (or omitted) to inherit the program setting.',
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  roundFinalGrade?: boolean | null;
}
