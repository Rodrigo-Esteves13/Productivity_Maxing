import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Código de 6 dígitos da app OU código de recuperação (xxxxx-xxxxx).
export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

export class TwoFactorLoginDto extends TwoFactorCodeDto {
  // Token curto devolvido pelo login quando a conta tem 2FA.
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  token: string;
}
