import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProgramDto } from './create-program.dto';

export class UpdateProgramDto extends PartialType(CreateProgramDto) {
  @ApiPropertyOptional({
    example: false,
    description:
      'false = archives the program (stops showing up in the selector by default, but is never deleted)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
