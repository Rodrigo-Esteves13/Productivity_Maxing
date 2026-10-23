import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { toUtf8TextBuffer } from './attachment-text.util';

// Validacao de um ficheiro enviado como anexo, partilhada pelo Notebook e
// pelos ficheiros da Turma: mesmo bucket privado, mesmos tipos aceites.

// Formatos com magic bytes reais - detetados pelo conteúdo do ficheiro,
// nunca pela extensão que o cliente diz que é (mesmo critério das
// fotos). DOCX/PPTX/XLSX são na prática ficheiros ZIP com uma estrutura
// interna própria; a `file-type` já sabe distinguir isso do ZIP genérico.
const ATTACHMENT_BINARY_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Formatos de texto puro - não têm magic bytes nenhuns para detetar (é
// só texto), por isso a validação aqui é diferente: sem bytes binários +
// extensão pedida nesta lista + limite de tamanho (ver
// ATTACHMENT_MAX_SIZE_BYTES). Nunca são executados em lado nenhum do
// servidor, só guardados e devolvidos como download.
const ATTACHMENT_TEXT_EXTENSIONS = new Set(['py', 'txt', 'md', 'json', 'csv']);

export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

// Só para o nome mostrado/descarregado depois - tira barras e
// caracteres de controlo/aspas (evita confundir o cabeçalho
// Content-Disposition do download). O caminho real no bucket nunca usa
// este valor, é sempre um UUID gerado no servidor (ver `path` em
// addAttachment), por isso isto não é uma defesa contra path traversal,
// é só higiene do nome mostrado.
function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[\\/]/g, '_')
      // eslint-disable-next-line no-control-regex -- remover caracteres de controlo é o próprio objetivo desta regex, não uma apanhada sem querer.
      .replace(/[\x00-\x1F\x7F"]/g, '')
      .trim()
  );
}

// Igual ao que createSignedUrl(path, ttl, { download: name }) devolve: o
// `download` nao faz parte da assinatura, o storage-js so o junta ao fim
// do URL (encodeURI de "&download=<nome>"). createSignedUrls so aceita um
// nome para o lote inteiro, por isso cada anexo recebe o seu aqui.
export function withDownloadName(signedUrl: string, fileName: string): string {
  if (!fileName) return signedUrl;
  const query = new URLSearchParams({ download: fileName }).toString();
  return `${signedUrl}${encodeURI(`&${query}`)}`;
}

export interface ValidatedAttachment {
  originalFileName: string;
  ext: string;
  content: Buffer;
  contentType: string;
}

export async function validateAttachmentUpload(
  file: Express.Multer.File,
): Promise<ValidatedAttachment> {
  // Nome tal como o cliente mandou, só para mostrar/descarregar depois -
  // nunca usado para o caminho no storage (isso é sempre um UUID, ver
  // `path` abaixo). Cortado a 200 chars para nunca deixar um
  // Content-Disposition com um nome descontrolado.
  const originalFileName =
    sanitizeFileName(file.originalname || 'file').slice(0, 200) || 'file';
  const claimedExt = originalFileName.includes('.')
    ? originalFileName.split('.').pop()!.toLowerCase()
    : '';

  // Nunca confiar na extensão nem no mimetype declarados pelo cliente -
  // para os formatos com magic bytes reais (PDF/DOCX/PPTX/XLSX/ZIP), o
  // tipo detetado é que manda, mesmo que a extensão pedida diga outra
  // coisa. Para texto puro (sem magic bytes), só aceite se a extensão
  // pedida estiver na lista permitida E o conteúdo não parecer binário.
  // Um tipo detetado fora da lista binaria (ex: "<?xml" no topo de um .md
  // da como application/xml, UTF-16 da como audio) nao manda: cai para a
  // validacao de texto, que e o que esses ficheiros sao.
  const detected = await fileTypeFromBuffer(file.buffer);
  const binaryExt = detected
    ? ATTACHMENT_BINARY_MIME_TO_EXT[detected.mime]
    : undefined;
  let ext: string | undefined = binaryExt;
  let content = file.buffer;
  if (!binaryExt && ATTACHMENT_TEXT_EXTENSIONS.has(claimedExt)) {
    const text = toUtf8TextBuffer(file.buffer);
    if (text) {
      ext = claimedExt;
      content = text;
    }
  }

  if (!ext) {
    throw new BadRequestException(
      'Unsupported file type. Allowed: PDF, DOCX, PPTX, XLSX, ZIP, PY, TXT, MD, JSON, CSV.',
    );
  }

  return {
    originalFileName,
    ext,
    content,
    contentType:
      binaryExt && detected ? detected.mime : 'application/octet-stream',
  };
}
