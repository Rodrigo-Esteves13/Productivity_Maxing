import { useState } from 'react';
import { getNotebookEntriesFull } from '../api/notebookService';
import { useI18n } from '../i18n/useI18n';
import { courseToMarkdown, entryTitle, entryToMarkdown, markdownFileName } from '../lib/notebookMarkdown';
import { downloadTextFile } from '../utils/downloadTextFile';
import type { Area, NotebookEntry } from '../types/models';

const MARKDOWN_MIME = 'text/markdown;charset=utf-8';

// Exportar a nota aberta ou a cadeira inteira em Markdown.
export function useNotebookExport(selectedArea: Area | null) {
  const { t } = useI18n();
  const [isExportingCourse, setIsExportingCourse] = useState(false);
  const [exportError, setExportError] = useState('');

  // A entrada aberta ja esta completa em memoria: descarrega logo.
  const exportEntry = (entry: NotebookEntry) => {
    if (!selectedArea) return;
    downloadTextFile(
      entryToMarkdown(entry, selectedArea.name, t),
      markdownFileName(selectedArea.name, entry.date.slice(0, 10), entryTitle(entry, t)),
      MARKDOWN_MIME,
    );
  };

  // A lista so tem resumos: a cadeira inteira pede o conteudo completo.
  const exportCourse = async () => {
    if (!selectedArea || isExportingCourse) return;
    setIsExportingCourse(true);
    setExportError('');
    try {
      const fullEntries = await getNotebookEntriesFull(selectedArea.id);
      downloadTextFile(courseToMarkdown(selectedArea.name, fullEntries, t), markdownFileName(selectedArea.name), MARKDOWN_MIME);
    } catch {
      setExportError(t('notebook.export.error'));
    } finally {
      setIsExportingCourse(false);
    }
  };

  return { isExportingCourse, exportError, exportEntry, exportCourse };
}
