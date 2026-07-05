import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Usado por PATCH /auth/me. De propósito só tem `name`: o avatar tem o seu
// próprio endpoint (POST /auth/me/avatar) porque é um upload de ficheiro,
// não um campo de texto — assim nunca se aceita um avatarUrl arbitrário
// vindo do cliente, só o que o próprio Supabase Storage devolve.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Rodrigo Esteves' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}
