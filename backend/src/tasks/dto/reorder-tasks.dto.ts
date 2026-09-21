import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// A ordem completa em que as tasks devem passar a aparecer - o índice de
// cada ID nesta lista vira o seu novo sortOrder (ver TasksService.reorder).
export class ReorderTasksDto {
  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2', 'uuid-3'] })
  @IsArray()
  @ArrayMinSize(1)
  // Um drag nunca envolve mais tasks do que as visíveis na grid de uma
  // vez - este limite é só uma rede de segurança contra um payload
  // disparatado, não uma expectativa real de uso.
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  taskIds: string[];
}
