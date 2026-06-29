import { IsHexColor, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Matemática', description: 'Nome da Área' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '#FF5733', description: 'Cor em formato Hexadecimal' })
  @IsHexColor()
  colorHex: string;
}