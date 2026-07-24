import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePeriodDto } from './create-period.dto';

// Same fields as CreatePeriodDto, minus programId - a period never moves
// to a different program through this endpoint, only renamed/redated.
export class UpdatePeriodDto extends PartialType(
  OmitType(CreatePeriodDto, ['programId'] as const),
) {}
