import type { NotebookEntryType, NotebookTable } from '../../../types/models';
import type { SegmentedOption } from '../../UI/SegmentedControl';

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

export const ENTRY_TYPE_OPTIONS: SegmentedOption<NotebookEntryType>[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'STUDY', label: 'Study' },
  { value: 'CLASS', label: 'Class' },
];

// Estilo dos campos pequenos do editor (class #, data, etiqueta/URL de links).
export const SMALL_INPUT_CLASS =
  'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none';

export function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
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

// Antes disto, um erro ao gravar (ex: textContent > 50000 carateres, ou
// um 403 por CSRF token dessincronizado) desaparecia em silêncio -
// isSaving voltava a false e parecia ter gravado, sem gravar nada.
export function describeSaveError(status: number | undefined, textLength: number): string {
  if (status === 400 && textLength > MAX_TEXT_CONTENT_LENGTH) {
    return `Notes are too long (${textLength.toLocaleString()}/${MAX_TEXT_CONTENT_LENGTH.toLocaleString()} characters). Trim the text before saving.`;
  }
  if (status === 403) return 'Session out of sync (403). Refresh the page and try saving again.';
  return 'Could not save this entry. Please try again.';
}

// Validadores rápidos de ficheiros: devolvem a mensagem de erro, ou null se
// o ficheiro serve. Servem só para poupar um pedido ao servidor.
export function validatePhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return 'Use PNG, JPG or WEBP.';
  if (file.size > MAX_PHOTO_SIZE) return 'Photo must be under 8MB.';
  return null;
}

export function validateAttachment(file: File, currentCount: number): string | null {
  const claimedExt = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  if (!ACCEPTED_ATTACHMENT_EXTENSIONS.includes(claimedExt)) {
    return `Allowed: ${ACCEPTED_ATTACHMENT_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE) return 'File must be under 20MB.';
  if (currentCount >= MAX_ATTACHMENTS_PER_ENTRY) {
    return `Each entry can have at most ${MAX_ATTACHMENTS_PER_ENTRY} files attached.`;
  }
  return null;
}
