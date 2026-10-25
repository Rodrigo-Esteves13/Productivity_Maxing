import type { NotebookTable } from '../../../types/models';
import { translateNow } from '../../../i18n/translate';
import { toLocalDateKey } from '../../../lib/dateKey';

// Tem de bater certo com @MaxLength(50000) em textContent no DTO do
// backend (upsert-notebook-entry.dto.ts) - usado aqui só para mostrar o
// contador/aviso antes do utilizador tentar gravar, o backend continua a
// ser a validação que conta a sério.
export const MAX_TEXT_CONTENT_LENGTH = 50000;

export const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Mesmo limite/lista que o backend aplica a sério (ver
// ATTACHMENT_MAX_SIZE_BYTES/ATTACHMENT_BINARY_MIME_TO_EXT/
// ATTACHMENT_TEXT_EXTENSIONS em notebook.service.ts) - isto aqui é só
// para dar feedback cedo sem gastar um pedido; a validação que importa
// (magic bytes / deteção de conteúdo binário) é sempre feita no backend.
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ENTRY = 10;
export const ACCEPTED_ATTACHMENT_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.zip',
  '.py',
  '.txt',
  '.md',
  '.json',
  '.csv',
];

export const MAX_TABLE_ROWS = 30;
export const MAX_TABLE_COLS = 12;

// Estilo dos campos pequenos do editor (class #, data, etiqueta/URL de links).
export const SMALL_INPUT_CLASS =
  'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none';

// Dia LOCAL da entrada (o que a lista mostra). Cortar o ISO dava o dia UTC:
// uma nota das 22:30 em Sao Paulo ou das 08:00 em Toquio ficava no dia errado
// e o primeiro autosave gravava esse dia errado (C-05).
export function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : toLocalDateKey(date);
}

// Data de uma entrada nova: meio-dia local de hoje, igual ao que o editor
// grava (`${dia}T12:00:00`), para o dia nao saltar com o arredondamento UTC.
export function newEntryDateIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).toISOString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createEmptyTable(rows: number, cols: number): NotebookTable {
  const safeRows = Math.min(Math.max(rows, 1), MAX_TABLE_ROWS);
  const safeCols = Math.min(Math.max(cols, 1), MAX_TABLE_COLS);
  return {
    id: crypto.randomUUID(),
    rows: Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => '')),
  };
}

// Aceita "example.com" sem obrigar a escrever "https://" - o backend
// exige protocolo explícito (@IsUrl), por isso completa-se aqui.
export function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Mesmas regras do @IsUrl({ protocols: ['http', 'https'], require_protocol:
// true }) + @MaxLength(2000) do UsefulLinkDto no backend. Sem isto um link
// que o backend recusa entrava na lista e, dai em diante, cada autosave da
// entrada inteira falhava com "Could not save", sem dizer porque.
const LINK_URL_MAX_LENGTH = 2000;
const TLD_PATTERN = /^([a-z¡-￿]{2,}|xn--[a-z0-9-]{2,})$/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/** URL pronto a gravar (com protocolo), ou null se o backend o recusaria. */
export function toLinkUrl(raw: string): string | null {
  const url = withProtocol(raw.trim());
  if (url.length > LINK_URL_MAX_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (IPV4_PATTERN.test(parsed.hostname)) return url;
  const labels = parsed.hostname.split('.');
  if (labels.length < 2 || labels.some((label) => label === '')) return null;
  return TLD_PATTERN.test(labels[labels.length - 1]) ? url : null;
}

// Antes disto, um erro ao gravar (ex: textContent > 50000 carateres, ou
// um 403 por CSRF token dessincronizado) desaparecia em silêncio -
// isSaving voltava a false e parecia ter gravado, sem gravar nada.
export function describeSaveError(status: number | undefined, textLength: number): string {
  if (status === 400 && textLength > MAX_TEXT_CONTENT_LENGTH) {
    return translateNow('notebook.err.tooLong', { length: textLength.toLocaleString(), max: MAX_TEXT_CONTENT_LENGTH.toLocaleString() });
  }
  if (status === 403) return translateNow('notebook.err.csrf');
  return translateNow('notebook.err.save');
}

// Validadores rápidos de ficheiros: devolvem a mensagem de erro, ou null se
// o ficheiro serve. Servem só para poupar um pedido ao servidor.
export function validatePhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return translateNow('notebook.err.photoType');
  if (file.size > MAX_PHOTO_SIZE) return translateNow('notebook.err.photoSize');
  return null;
}

export function validateAttachment(file: File, currentCount: number): string | null {
  const claimedExt = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  if (!ACCEPTED_ATTACHMENT_EXTENSIONS.includes(claimedExt)) {
    return `Allowed: ${ACCEPTED_ATTACHMENT_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE) return translateNow('notebook.err.fileSize');
  if (currentCount >= MAX_ATTACHMENTS_PER_ENTRY) {
    return translateNow('notebook.err.maxFiles', { max: MAX_ATTACHMENTS_PER_ENTRY });
  }
  return null;
}
