import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Resposta do user ao prompt de "overdue check-in": esta task, que já
// passou o prazo, está de facto feita ou continua pendente?
export class ConfirmOverdueDto {
  @ApiProperty({
    example: true,
    description:
      'True if the task is actually done, false if it is still pending.',
  })
  @IsBoolean()
  isCompleted!: boolean;
}
