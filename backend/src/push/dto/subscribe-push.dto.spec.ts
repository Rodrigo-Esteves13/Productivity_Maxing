import 'reflect-metadata';
import { createECDH, randomBytes } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  isValidP256dh,
  isValidPushAuth,
  PUSH_AUTH_BYTES,
  SubscribePushDto,
} from './subscribe-push.dto';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';

// Chaves reais como as do browser (PushSubscription.toJSON): base64url.
function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(PUSH_AUTH_BYTES).toString('base64url'),
  };
}

async function errorsFor(keys: Record<string, unknown>) {
  const dto = plainToInstance(SubscribePushDto, { endpoint: ENDPOINT, keys });
  return validate(dto);
}

describe('SubscribePushDto keys', () => {
  it('accepts real browser keys', async () => {
    expect(await errorsFor(browserKeys())).toHaveLength(0);
  });

  it('accepts base64url with padding', () => {
    const { p256dh, auth } = browserKeys();
    expect(isValidP256dh(`${p256dh}=`)).toBe(true);
    expect(isValidPushAuth(`${auth}==`)).toBe(true);
  });

  it('rejects garbage, wrong lengths and a compressed point', async () => {
    const good = browserKeys();
    const compressed = Buffer.alloc(65, 1);
    compressed[0] = 0x02;
    const cases: Record<string, unknown>[] = [
      { ...good, p256dh: 'p' },
      { ...good, auth: 'a' },
      { ...good, p256dh: 'not base64!' },
      { ...good, auth: '+/+/+/+/+/+/+/+/+/+/+w' },
      { ...good, p256dh: randomBytes(64).toString('base64url') },
      { ...good, p256dh: compressed.toString('base64url') },
      { ...good, auth: randomBytes(32).toString('base64url') },
      { ...good, p256dh: 42 },
    ];
    for (const keys of cases) {
      expect((await errorsFor(keys)).length).toBeGreaterThan(0);
    }
  });
});
