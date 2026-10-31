// Caminhos da app usados nos avisos push (e noutros links gerados no
// servidor). Num so sitio para o frontend e o backend nao divergirem.

/** Abre a nota no caderno do dono, com o painel de partilha aberto. */
export const notebookEntrySharePath = (entryId: string): string =>
  `/notebook?entry=${encodeURIComponent(entryId)}&share=1`;

/** Social no separador de pedidos (amizade, convites, leitura de notas). */
export const SOCIAL_REQUESTS_PATH = '/social?tab=requests';

/** Lista de dispositivos com sessao iniciada (onde se termina uma sessao). */
export const DEVICES_PATH = '/devices';
