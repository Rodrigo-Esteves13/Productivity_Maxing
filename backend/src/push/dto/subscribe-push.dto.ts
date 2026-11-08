import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import { PUSH_LANGUAGES } from '../push-messages';

// Chaves de uma PushSubscription (RFC 8291), como as da PushSubscription.toJSON()
// do browser: base64url, com ou sem padding.
// p256dh = ponto P-256 nao comprimido (65 bytes, comeca por 0x04).
// auth = segredo de 16 bytes.
export const PUSH_P256DH_BYTES = 65;
export const PUSH_P256DH_UNCOMPRESSED_PREFIX = 0x04;
export const PUSH_AUTH_BYTES = 16;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function decodeBase64Url(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) return null;
  return Buffer.from(value, 'base64url');
}

export function isValidP256dh(value: unknown): boolean {
  const bytes = decodeBase64Url(value);
  return (
    bytes !== null &&
    bytes.length === PUSH_P256DH_BYTES &&
    bytes[0] === PUSH_P256DH_UNCOMPRESSED_PREFIX
  );
}

export function isValidPushAuth(value: unknown): boolean {
  const bytes = decodeBase64Url(value);
  return bytes !== null && bytes.length === PUSH_AUTH_BYTES;
}

function IsPushP256dh(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPushP256dh',
      validator: {
        validate: (value) => isValidP256dh(value),
        defaultMessage: () =>
          'keys.p256dh must be a base64url P-256 public key.',
      },
    },
    options,
  );
}

function IsPushAuth(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPushAuth',
      validator: {
        validate: (value) => isValidPushAuth(value),
        defaultMessage: () => 'keys.auth must be a base64url 16 byte secret.',
      },
    },
    options,
  );
}

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @IsPushP256dh()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @IsPushAuth()
  auth: string;
}

export class SubscribePushDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsOptional()
  @IsIn(PUSH_LANGUAGES)
  lang?: string;
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint: string;
}
