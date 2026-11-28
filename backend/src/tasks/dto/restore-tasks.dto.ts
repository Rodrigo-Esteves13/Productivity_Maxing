import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { MAX_SUBTASKS_PER_TASK, MAX_SUBTASK_TITLE_LENGTH } from './subtask.dto';
import { TASK_RESTORE_BATCH_MAX } from '../tasks.constants';

export class RestoreSubtaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SUBTASK_TITLE_LENGTH)
  title: string;

  @ApiProperty()
  @IsBoolean()
  isDone: boolean;
}

export class RestoreTaskDto extends CreateTaskDto {
  @ApiPropertyOptional({
    description:
      'Original completion moment, only used when progressStatus is COMPLETED. Never later than now.',
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @ApiPropertyOptional({ type: [RestoreSubtaskDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SUBTASKS_PER_TASK)
  @ValidateNested({ each: true })
  @Type(() => RestoreSubtaskDto)
  subtasks?: RestoreSubtaskDto[];
}

export class RestoreTasksDto {
  @ApiProperty({
    type: [RestoreTaskDto],
    description: `Deleted tasks to create again (max ${TASK_RESTORE_BATCH_MAX} per request).`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TASK_RESTORE_BATCH_MAX)
  @ValidateNested({ each: true })
  @Type(() => RestoreTaskDto)
  tasks: RestoreTaskDto[];
}
