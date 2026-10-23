import { createHmac } from 'crypto';

const HASH_LENGTH = 32;

// HMAC do IP de quem grava um pad sem conta: a moderacao ve que a mesma
// origem encheu varios pads de lixo, sem nunca guardar o IP. Chave DERIVADA
// do JWT_SECRET com um rotulo proprio (mesmo padrao das visitas a notas
// partilhadas, NotebookService.visitorKey): o mesmo segredo nao serve dois
// fins. Sem IP ou sem segredo, nao guarda nada.
export function hashPadIp(ip: string | undefined): string | null {
  const base = process.env.JWT_SECRET;
  if (!base || !ip) return null;
  const key = createHmac('sha256', base).update('pad-ip-v1').digest();
  return createHmac('sha256', key)
    .update(ip)
    .digest('hex')
    .slice(0, HASH_LENGTH);
}
