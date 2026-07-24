import {
  IsHexColor,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Mathematics', description: 'Area name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: '#FF5733',
    description: 'Color in hexadecimal format',
  })
  @IsOptional()
  @IsHexColor()
  colorHex: string;

  @ApiPropertyOptional({
    example: 'ACADEMICO',
    description:
      'TaskType key used by default in this Area (e.g. "CDR" -> "ACADEMICO"). null/omitted = no associated type (e.g. hobbies).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultTaskType?: string | null;

  @ApiPropertyOptional({
    example: 6,
    description:
      'Créditos (ECTS ou equivalente) desta cadeira. Opcional - nem todo o nível de ensino usa este conceito (ex: secundário). null/omitted = sem créditos definidos, entra com peso 1 no cálculo da média.',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  credits?: number | null;
}
