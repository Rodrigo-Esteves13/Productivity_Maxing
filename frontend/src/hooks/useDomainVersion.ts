import { useSyncExternalStore } from 'react';
import { getDomainsVersion, subscribeToDomainChanges, type DataDomain } from '../lib/domainEvents';

// Versao combinada dos dominios pedidos (ver lib/domainEvents.ts). Muda
// sempre que outra parte da app grava num deles.
export function useDomainVersion(domains: readonly DataDomain[]): number {
  return useSyncExternalStore(subscribeToDomainChanges, () => getDomainsVersion(domains));
}

// Chave pronta para `refreshKey`: junta a versao dos dominios a uma chave
// que o hook ja tinha (ex: o id da ultima sessao terminada). Muda quando
// qualquer uma das duas muda, por isso o fetch refaz-se em silencio.
export function useDomainKey(domains: readonly DataDomain[], baseKey?: string | number | null): string {
  const version = useDomainVersion(domains);
  return `${baseKey ?? ''}#${version}`;
}
