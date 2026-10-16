import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RATING_MAX, RATING_MIN } from '../../common/rating.constants';

export class SetAreaInterestDto {
  @ApiProperty({ example: 4, minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating: number;
}
