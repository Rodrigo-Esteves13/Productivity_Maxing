import { useCallback, useEffect, useState } from 'react';
import {
  MAX_TASK_TEMPLATES,
  MAX_TEMPLATE_NAME_LENGTH,
  parseStoredTemplates,
  type TaskTemplate,
} from '../lib/taskTemplates';

const STORAGE_KEY = 'pm-task-templates';

function loadTemplates(): TaskTemplate[] {
  try {
    return parseStoredTemplates(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Modelos de task, so neste browser (mesmo padrao dos outros prefs em
// localStorage). Guardar com um nome que ja existe substitui esse modelo.
export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>(loadTemplates);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Best-effort only, same as every other localStorage pref in this app.
    }
  }, [templates]);

  // Devolve false quando nao gravou (nome vazio ou ja ha MAX_TASK_TEMPLATES).
  const saveTemplate = useCallback(
    (draft: Omit<TaskTemplate, 'id'>): boolean => {
      const name = draft.name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
      if (!name) return false;
      const existing = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        setTemplates(templates.map((t) => (t.id === existing.id ? { ...draft, name, id: existing.id } : t)));
        return true;
      }
      if (templates.length >= MAX_TASK_TEMPLATES) return false;
      setTemplates([...templates, { ...draft, name, id: newId() }].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    },
    [templates],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, saveTemplate, deleteTemplate, isFull: templates.length >= MAX_TASK_TEMPLATES };
}
