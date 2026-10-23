// Que anexos tem preview dentro da app, por extensao validada no backend
// (NotebookAttachment.extension). DOCX/PPTX/XLSX/ZIP nao tem: so download.
export type AttachmentPreviewKind = 'pdf' | 'text';

// O que o preview precisa de um ficheiro: anexos do Notebook e ficheiros da
// Turma tem ambos esta forma.
export interface PreviewableFile {
  id: string;
  originalFileName: string;
  extension: string;
  url: string | null;
}

const PREVIEW_KIND_BY_EXTENSION: Record<string, AttachmentPreviewKind> = {
  pdf: 'pdf',
  md: 'text',
  txt: 'text',
  py: 'text',
  json: 'text',
  csv: 'text',
};

// O PDF e mostrado num iframe a partir de um blob: com este tipo fixo, nunca
// com o tipo que o Storage devolveu.
export const PDF_MIME_TYPE = 'application/pdf';

// Um .txt de 20 MB num <pre> bloqueia a pagina; o resto fica para o download.
export const TEXT_PREVIEW_MAX_CHARS = 200_000;

export function getPreviewKind(extension: string): AttachmentPreviewKind | null {
  return PREVIEW_KIND_BY_EXTENSION[extension.toLowerCase()] ?? null;
}
