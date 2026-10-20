import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth-limits';

// POST /auth/password-link - o token vem do link enviado por email (ver
// PasswordLinkService) e a password e escolhida nessa pagina.
export class CompletePasswordLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
