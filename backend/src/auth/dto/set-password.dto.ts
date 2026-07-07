import { IsString, MinLength, MaxLength } from 'class-validator';

// Usado por POST /auth/set-password. Serve tanto para "adicionar" password a
// uma conta só-OAuth como para mudar a password de uma conta que já tinha
// uma - a rota é sempre autenticada (JwtAuthGuard), por isso não pedimos a
// password atual: a sessão válida já prova que é o dono da conta.
export class SetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'A password tem de ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  password: string;
}