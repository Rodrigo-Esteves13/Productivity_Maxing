import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth-limits';

// Mesmos limites do registo (RegisterDto): um corpo enorme nunca chega ao
// Supabase.
export class LoginDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
