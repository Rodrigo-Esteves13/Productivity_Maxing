import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
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
}
