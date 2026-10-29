import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({ example: 'k3J9xQ2mVb' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  friendCode: string;
}

export class ClassmateFriendRequestDto {
  @ApiProperty({ description: 'A class you both belong to.' })
  @IsUUID()
  turmaId: string;

  @ApiProperty({ description: 'The classmate to add.' })
  @IsUUID()
  userId: string;
}

export class BlockUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class FriendCodeChangeRequestDto {
  @ApiProperty({ description: 'Why you need a new friend code.' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}

export class DecideFriendCodeRequestDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiProperty({ required: false, description: 'Shown to the user.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}
