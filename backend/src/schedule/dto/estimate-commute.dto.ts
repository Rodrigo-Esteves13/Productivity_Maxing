import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CommuteMode } from '@prisma/client';

// Ambos obrigatórios: este endpoint grava logo homeAddress/campusAddress +
// o commuteMinutes resultante no User (ver ScheduleService.estimateCommute)
// - não é só um "preview", é o próprio fluxo de configurar automaticamente.
// Para só editar o valor manual sem endereços, o caminho continua a ser
// PATCH /auth/me { commuteMinutes }.
export class EstimateCommuteDto {
  @ApiProperty({ example: 'Rua Exemplo 123, Porto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  homeAddress: string;

  @ApiProperty({ example: 'Instituto XYZ, Maia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  campusAddress: string;

  // Nem todo o estudante tem carro - mode escolhe que tipo de rota a
  // Distance Matrix API calcula (os valores do enum batem certo com os
  // aceites pela própria API). Obrigatório porque não há um "modo certo
  // por omissão" que sirva para todos - o frontend tem sempre um
  // dropdown selecionado, nunca fica por escolher.
  @ApiProperty({ enum: CommuteMode, example: CommuteMode.TRANSIT })
  @IsEnum(CommuteMode)
  mode: CommuteMode;
}
