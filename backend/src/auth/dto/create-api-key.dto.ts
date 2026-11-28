import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ApiKeyScope } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { API_KEY_NAME_MAX_LENGTH } from './auth-limits';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'League bot script' })
  @IsOptional()
  @IsString()
  @MaxLength(API_KEY_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    enum: ApiKeyScope,
    example: ApiKeyScope.TASKS,
    description:
      "Defaults to TASKS. Requesting ADMIN only succeeds if the requester's own Role is ADMIN - see AuthService.generateApiKey().",
  })
  @IsOptional()
  @IsEnum(ApiKeyScope)
  scope?: ApiKeyScope;
}
