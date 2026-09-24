import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateAppealDto {
  // MinLength alto o suficiente para desencorajar um "pls unban" de uma
  // linha, sem impedir um pedido genuíno mas curto.
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  message: string;
}
