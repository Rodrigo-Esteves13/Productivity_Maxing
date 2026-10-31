import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TEACHER_NAME_MAX_LENGTH } from '../area-teachers.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SetAreaTeacherDto {
  @ApiProperty({ example: 'Maria Silva', maxLength: TEACHER_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEACHER_NAME_MAX_LENGTH)
  teacherName: string;
}
