import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// Usado por PATCH /users/:id, só um ADMIN chega aqui (ver users.controller).
// De propósito não inclui email nem avatarUrl: mudar o email de outra pessoa
// sem passar pelo fluxo de verificação seria um vetor de account takeover, e
// o avatar continua a ser só o próprio dono a poder trocar (upload real,
// via POST /auth/me/avatar).
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Rodrigo Esteves' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
