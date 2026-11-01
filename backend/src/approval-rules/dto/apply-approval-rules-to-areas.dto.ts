import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpsertApprovalRulesDto } from './upsert-approval-rules.dto';

export const APPLY_RULES_AREA_IDS_MAX = 500;

/** Mesmo corpo das regras + escolha opcional das cadeiras (omitido = todas). */
export class ApplyApprovalRulesToAreasDto extends UpsertApprovalRulesDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Courses to apply to. Omitted = every accessible course.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(APPLY_RULES_AREA_IDS_MAX)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  areaIds?: string[];
}
