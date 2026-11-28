import { IsEmail, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../email.util';
import { EMAIL_MAX_LENGTH } from './auth-limits';

// Usado por POST /auth/forgot-password. De propósito só pede o email, a
// resposta é sempre genérica (ver AuthService.forgotPassword), para nunca
// confirmar/negar se aquele email tem conta.
export class ForgotPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;
}
