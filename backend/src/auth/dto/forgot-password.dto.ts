import { IsEmail } from 'class-validator';

// Usado por POST /auth/forgot-password. De propósito só pede o email, a
// resposta é sempre genérica (ver AuthService.forgotPassword), para nunca
// confirmar/negar se aquele email tem conta.
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
