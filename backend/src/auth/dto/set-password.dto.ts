import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth-limits';

// Usado por PATCH /auth/me/password. Serve tanto para "adicionar" password a
// uma conta só-OAuth como para mudar a password de uma conta que já tinha
// uma. Se a conta já tem password, a atual é obrigatória (ver
// PasswordAuthService.setPassword): uma sessão roubada não chega para tomar
// a conta trocando a password.
export class SetPasswordDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword?: string;
}
