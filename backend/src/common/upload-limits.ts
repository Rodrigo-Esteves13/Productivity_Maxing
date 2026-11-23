import { FileInterceptor } from '@nestjs/platform-express';
import type { Options as MulterOptions } from 'multer';

// Tamanhos maximos de upload (bytes), um sitio so para os controllers.
const BYTES_PER_MB = 1024 * 1024;

export const AVATAR_MAX_SIZE_BYTES = 5 * BYTES_PER_MB;
export const NOTEBOOK_PHOTO_MAX_SIZE_BYTES = 8 * BYTES_PER_MB;
// Anexos (notebook, tarefas, turmas): documentos pesam mais que uma foto.
export const ATTACHMENT_MAX_SIZE_BYTES = 20 * BYTES_PER_MB;

// Uploads de ficheiros por minuto e por IP, em cima do limite global.
export const UPLOADS_PER_MINUTE = 10;
export const AVATAR_UPLOADS_PER_MINUTE = UPLOADS_PER_MINUTE;

// Mitigacao GHSA-72gw-mp4g-v24j: fieldNestingDepth ainda nao esta no tipo
// Options.limits do @types/multer instalado.
export type MulterLimitsWithFieldNestingDepth = NonNullable<
  MulterOptions['limits']
> & {
  fieldNestingDepth?: number;
};

const SINGLE_FILE_COUNT = 1;
const NO_EXTRA_FIELDS = 0;
const FIELD_NESTING_DEPTH = 1;

// Interceptor de upload de um unico ficheiro: tamanho maximo, 1 ficheiro,
// 0 campos extra e profundidade de aninhamento limitada.
export function singleFileUpload(field: string, maxBytes: number) {
  return FileInterceptor(field, {
    limits: {
      fileSize: maxBytes,
      files: SINGLE_FILE_COUNT,
      fields: NO_EXTRA_FIELDS,
      fieldNestingDepth: FIELD_NESTING_DEPTH,
    } as MulterLimitsWithFieldNestingDepth,
  });
}
