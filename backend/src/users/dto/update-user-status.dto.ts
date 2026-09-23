import { IsString, IsNotEmpty, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Motivo é sempre obrigatório (ao contrário do BannedIp, onde reason é
// opcional) - suspender/banir uma CONTA (não um IP anónimo) é uma ação
// bem mais grave, fica sempre registada com justificação.
export class SuspendUserDto {
  @ApiProperty({ example: 'Spam nas notas partilhadas - 3 denúncias.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsDateString()
  until: string;
}

export class BanUserDto {
  @ApiProperty({
    example: 'Conta usada para distribuir malware nos anexos do Notebook.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
