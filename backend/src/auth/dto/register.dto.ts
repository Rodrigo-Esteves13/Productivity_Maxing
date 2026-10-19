import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth-limits';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
