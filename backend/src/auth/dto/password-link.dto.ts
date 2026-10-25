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

// POST /auth/reset-password - fim do "esqueci-me da password". O accessToken
// e o da sessao de recovery que o Supabase abre no browser ao seguir o link
// do email; o backend valida-o junto do Supabase antes de mudar a password
// e de terminar as outras sessoes (E-02).
export class CompletePasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  accessToken: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
