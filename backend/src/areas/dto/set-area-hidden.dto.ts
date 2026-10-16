import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetAreaHiddenDto {
  @ApiProperty({
    description: 'true = desligar (esconder), false = voltar a ligar',
  })
  @IsBoolean()
  hidden: boolean;
}
