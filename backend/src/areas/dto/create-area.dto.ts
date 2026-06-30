import { IsHexColor, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Matemática', description: 'Nome da Área' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '#FF5733', description: 'Cor em formato Hexadecimal' })
  @IsOptional()
  @IsHexColor()
  colorHex: string;
}