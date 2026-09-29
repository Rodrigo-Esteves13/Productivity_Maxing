import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShareVisibilityDto {
  @ApiProperty({ enum: ['PUBLIC', 'AUTHORIZED'] })
  @IsIn(['PUBLIC', 'AUTHORIZED'])
  visibility: 'PUBLIC' | 'AUTHORIZED';
}
