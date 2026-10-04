import type {
  CanvasLink,
  CanvasShape,
  CanvasTextItem,
  NotebookEntryType,
  NotebookTable,
  Stroke,
  UsefulLink,
} from '../../../types/models';

// O que o editor entrega a Notebook.tsx ao gravar uma entrada.
export interface NotebookEntrySavePayload {
  title: string;
  entryType: NotebookEntryType;
  classNumber?: number;
  textContent: string;
  drawingStrokes: Stroke[];
  tables: NotebookTable[];
  canvasShapes: CanvasShape[];
  canvasLinks: CanvasLink[];
  canvasTexts: CanvasTextItem[];
  usefulLinks: UsefulLink[];
  canvasHeight: number;
  date: string;
}
