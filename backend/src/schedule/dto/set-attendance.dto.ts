import { IsBoolean, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// PATCH /schedule/:id/attendance. null limpa a marcação (volta a "por
// marcar"); o campo tem de vir sempre - sem ele o IsBoolean falha, para um
// body vazio nunca apagar uma presença sem querer.
export class SetAttendanceDto {
  @ApiProperty({
    type: Boolean,
    nullable: true,
    example: true,
    description: 'true = attended, false = missed, null = not marked.',
  })
  @ValidateIf((dto: SetAttendanceDto) => dto.attended !== null)
  @IsBoolean()
  attended!: boolean | null;
}
