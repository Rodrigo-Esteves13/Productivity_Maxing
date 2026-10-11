import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// POST /auth/verify-email - o token vem do link enviado por email.
export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  token: string;
}

// POST /auth/resend-verification - só o email; a resposta é sempre genérica
// (nunca confirma se o email tem conta).
export class ResendVerificationDto {
  @IsEmail()
  email: string;
}
