import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsIP,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannedIpDto {
  // IsIP() sem versão aceita IPv4 ou IPv6 - o req.ip de qualquer pedido
  // pode vir em qualquer um dos dois, dependendo de como o cliente chegou
  // ao Render.
  @ApiProperty({ example: '203.0.113.42' })
  @IsString()
  @IsNotEmpty()
  @IsIP()
  ip: string;

  @ApiPropertyOptional({
    example: 'Tentativas repetidas de login com credenciais aleatórias',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
