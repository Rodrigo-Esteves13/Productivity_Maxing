import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Cifra os accessToken/refreshToken do OAuth (Google/GitHub/Discord) antes
 * de os gravar na tabela `Identity`, para que um dump da base de dados do
 * Supabase (ex: backup roubado, RLS mal configurada, acesso direto ao
 * Postgres) não exponha os tokens em texto plano - só quem tiver também a
 * TOKEN_ENCRYPTION_KEY (que vive apenas nas variáveis de ambiente do
 * backend, nunca na BD) consegue decifrar.
 *
 * AES-256-GCM: cifra simétrica autenticada. Cada valor cifrado tem um IV
 * (nonce) aleatório de 12 bytes + uma authTag de 16 bytes, para que:
 *   - o mesmo token em claro nunca produza o mesmo texto cifrado duas vezes
 *     (protege contra análise de padrões);
 *   - qualquer alteração ao texto cifrado (bit-flipping) seja detetada e
 *     rejeitada na decifragem (autenticidade, não só confidencialidade).
 *
 * Formato guardado na BD (tudo em base64): iv (12 bytes) || authTag (16
 * bytes) || ciphertext.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32; // AES-256 exige uma chave de 32 bytes

function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    // Falha alto e a gritar, tal como já fazemos para JWT_SECRET e
    // API_KEY_SECRET (ver assertRequiredEnvVars em main.ts) - nunca
    // gravar/ler tokens OAuth com uma chave vazia ou previsível.
    throw new Error(
      'TOKEN_ENCRYPTION_KEY não está definida. Não é seguro cifrar/decifrar tokens OAuth sem ela.',
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY inválida: tem de ser uma string em base64 que descodifica para exatamente ${KEY_LENGTH_BYTES} bytes (AES-256). ` +
        `Gera uma nova com: openssl rand -base64 32`,
    );
  }

  return key;
}

/** Cifra uma string em claro. Devolve o resultado codificado em base64. */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decifra uma string previamente cifrada por encryptToken(). */
export function decryptToken(encoded: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(encoded, 'base64');

  if (raw.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Valor cifrado inválido ou corrompido.');
  }

  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/** Versão de encryptToken() tolerante a valores nulos/undefined. */
export function encryptTokenNullable(
  plaintext: string | null | undefined,
): string | null {
  if (!plaintext) return null;
  return encryptToken(plaintext);
}

/** Versão de decryptToken() tolerante a valores nulos/undefined. */
export function decryptTokenNullable(
  encoded: string | null | undefined,
): string | null {
  if (!encoded) return null;
  return decryptToken(encoded);
}
