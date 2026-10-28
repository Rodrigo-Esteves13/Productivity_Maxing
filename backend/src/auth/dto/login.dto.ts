import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth-limits';
import { NormalizeEmail } from '../email.util';

// Mesmos limites do registo (RegisterDto): um corpo enorme nunca chega ao
// Supabase.
export class LoginDto {
  // Email ou so a parte antes do @ (ex: numero de aluno "A047610"),
  // resolvido em PasswordAuthService.resolveLoginEmail.
  @NormalizeEmail()
  @IsString()
  @MinLength(1)
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
