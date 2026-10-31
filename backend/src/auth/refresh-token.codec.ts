import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Formato do refresh token: "<sessionId>.<nonce>.<mac>"
// - sessionId: id da UserSession (a "familia" de tokens do dispositivo).
// - nonce: 32 bytes aleatorios (a entropia que torna o token imprevisivel).
// - mac: HMAC-SHA256 de "<sessionId>.<nonce>" com uma chave do servidor.
//
// A BD guarda so o SHA-256 do token atual. O mac serve para a deteccao de
// reutilizacao: um token com mac valido para uma sessao, mas que ja nao e o
// atual, so pode ser um token que o servidor emitiu antes para essa sessao
// (ja rodado). Sem o mac, qualquer pessoa que soubesse o id de uma sessao
// conseguia forjar "um token antigo" e revoga-la.
const SEPARATOR = '.';
const NONCE_BYTES = 32;
// Separacao de dominio: a chave do mac deriva do JWT_SECRET mas nunca e igual
// a ele (um mac nunca vale como assinatura de JWT, nem o contrario).
const MAC_KEY_LABEL = 'pmaxing/refresh-token-mac/v1';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface MintedRefreshToken {
  token: string;
  hash: string;
}

export class RefreshTokenCodec {
  private readonly macKey: Buffer;

  constructor(secret: string) {
    if (!secret) {
      throw new Error('Refresh token secret is not defined.');
    }
    this.macKey = createHmac('sha256', secret).update(MAC_KEY_LABEL).digest();
  }

  /** SHA-256 (hex) do token, o unico valor que vai para a BD. */
  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  mint(sessionId: string): MintedRefreshToken {
    const nonce = randomBytes(NONCE_BYTES).toString('base64url');
    const body = `${sessionId}${SEPARATOR}${nonce}`;
    const token = `${body}${SEPARATOR}${this.mac(body)}`;
    return { token, hash: RefreshTokenCodec.hash(token) };
  }

  /**
   * Id da sessao a que o token pertence, so se o mac bater certo (o token foi
   * mesmo emitido por este servidor). null para qualquer valor mal formado
   * ou forjado.
   */
  parse(token: string | undefined | null): string | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split(SEPARATOR);
    if (parts.length !== 3) return null;
    const [sessionId, nonce, mac] = parts;
    if (!UUID_PATTERN.test(sessionId)) return null;
    if (!BASE64URL_PATTERN.test(nonce) || !BASE64URL_PATTERN.test(mac)) {
      return null;
    }
    const expected = Buffer.from(this.mac(`${sessionId}${SEPARATOR}${nonce}`));
    const given = Buffer.from(mac);
    if (expected.length !== given.length) return null;
    return timingSafeEqual(expected, given) ? sessionId : null;
  }

  private mac(body: string): string {
    return createHmac('sha256', this.macKey).update(body).digest('base64url');
  }
}
