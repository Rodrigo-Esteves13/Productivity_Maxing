import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertScheduleLinkDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  areaId: string;

  // Texto exato tal como aparece em ClassOccurrence.subject (vindo do
  // .ics) - normalmente a sigla curta da faculdade (ex: "PC"), não o nome
  // completo da cadeira. Ver ImportScheduleRowDto.subject.
  @ApiProperty({ example: 'PC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  scheduleSubject: string;
}
