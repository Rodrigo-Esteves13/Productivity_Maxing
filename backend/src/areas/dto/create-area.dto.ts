import { IsHexColor, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Mathematics', description: 'Area name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '#FF5733',
    description: 'Cor em formato Hexadecimal',
  })
  @IsOptional()
  @IsHexColor()
  colorHex: string;

  @ApiPropertyOptional({
    example: 'ACADEMICO',
    description:
      'Key do TaskType usado por omissão nesta Area (ex: "CDR" -> "ACADEMICO"). null/omitido = sem tipo associado (ex: hobbies).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  defaultTaskType?: string | null;
}
