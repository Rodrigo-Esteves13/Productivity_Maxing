import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'A password tem de ter pelo menos 8 caracteres.' })
  @MaxLength(72) // limite prático para o scrypt/bcrypt não crescer sem necessidade
  password: string;
}
