import { useCallback, useEffect, useState } from 'react';
import type { NotebookEntry, NotebookEntryType, NotebookTable, UsefulLink } from '../types/models';
import { DEFAULT_VIEW_HEIGHT, GROW_STEP, MAX_VIEW_HEIGHT } from '../components/Notebook/canvas/canvasConstants';
import { createEmptyTable, toDateInputValue } from '../components/Notebook/entry/notebookEntryConfig';

// Rascunho editavel de uma entrada do Notebook: os campos simples (titulo,
// tipo, data, texto, tabelas, links, altura do canvas). O canvas em si
// (tracos, formas...) tem os seus proprios hooks.
export function useEntryDraft(entry: NotebookEntry) {
  const [title, setTitle] = useState(entry.title);
  const [entryType, setEntryType] = useState<NotebookEntryType>(entry.entryType);
  const [classNumber, setClassNumber] = useState<string>(entry.classNumber != null ? String(entry.classNumber) : '');
  const [dateValue, setDateValue] = useState(toDateInputValue(entry.date));
  const [textContent, setTextContent] = useState(entry.textContent ?? '');
  const [tables, setTables] = useState<NotebookTable[]>(entry.tables ?? []);
  const [usefulLinks, setUsefulLinks] = useState<UsefulLink[]>(entry.usefulLinks ?? []);
  const [canvasHeight, setCanvasHeight] = useState<number>(entry.canvasHeight ?? DEFAULT_VIEW_HEIGHT);

  // Trocar de entrada (outro item da lista) tem de repor o editor inteiro -
  // sem isto os campos da entrada anterior "vazavam" para a seguinte até
  // o utilizador tocar em cada um.
  useEffect(() => {
    setTitle(entry.title);
    setEntryType(entry.entryType);
    setClassNumber(entry.classNumber != null ? String(entry.classNumber) : '');
    setDateValue(toDateInputValue(entry.date));
    setTextContent(entry.textContent ?? '');
    setTables(entry.tables ?? []);
    setUsefulLinks(entry.usefulLinks ?? []);
    setCanvasHeight(entry.canvasHeight ?? DEFAULT_VIEW_HEIGHT);
  }, [
    entry.id,
    entry.title,
    entry.entryType,
    entry.classNumber,
    entry.date,
    entry.textContent,
    entry.tables,
    entry.usefulLinks,
    entry.canvasHeight,
  ]);

  const addTable = useCallback((rows: number, cols: number) => {
    setTables((prev) => [...prev, createEmptyTable(rows, cols)]);
  }, []);

  const growCanvas = useCallback(() => {
    setCanvasHeight((prev) => Math.min(prev + GROW_STEP, MAX_VIEW_HEIGHT));
  }, []);

  return {
    title, setTitle,
    entryType, setEntryType,
    classNumber, setClassNumber,
    dateValue, setDateValue,
    textContent, setTextContent,
    tables, setTables,
    usefulLinks, setUsefulLinks,
    canvasHeight,
    addTable,
    growCanvas,
  };
}
