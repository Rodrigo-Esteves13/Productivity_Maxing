import { useCallback } from 'react';
import {
  MAX_TASK_TEMPLATES,
  MAX_TEMPLATE_NAME_LENGTH,
  parseStoredTemplates,
  type TaskTemplate,
} from '../lib/taskTemplates';
import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { ACCOUNT_SCOPED_KEYS, accountStorageKey } from '../lib/storageKeys';

const CODEC: PersistedCodec<TaskTemplate[]> = {
  parse: parseStoredTemplates,
  serialize: (templates) => JSON.stringify(templates),
};

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Modelos de task, so neste browser e separados por conta (mesmo padrao dos
// outros prefs em localStorage). Guardar com um nome que ja existe substitui esse modelo.
export function useTaskTemplates() {
  const [templates, setTemplates] = usePersistedState(accountStorageKey(ACCOUNT_SCOPED_KEYS.taskTemplates), CODEC);

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
    [templates, setTemplates],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [setTemplates]);

  // Modelo com este nome (sem maiusculas), para pedir confirmacao antes de o substituir.
  const findByName = useCallback(
    (name: string): TaskTemplate | undefined => {
      const wanted = name.trim().toLowerCase();
      return templates.find((t) => t.name.toLowerCase() === wanted);
    },
    [templates],
  );

  // Repoe um modelo apagado (Anular), com o mesmo id.
  const restoreTemplate = useCallback((template: TaskTemplate) => {
    setTemplates((prev) =>
      prev.some((t) => t.id === template.id) || prev.length >= MAX_TASK_TEMPLATES
        ? prev
        : [...prev, template].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, [setTemplates]);

  // Devolve false se o nome ficar vazio ou ja for de outro modelo.
  const renameTemplate = useCallback(
    (id: string, rawName: string): boolean => {
      const name = rawName.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
      if (!name) return false;
      const clash = templates.find((t) => t.id !== id && t.name.toLowerCase() === name.toLowerCase());
      if (clash) return false;
      setTemplates(templates.map((t) => (t.id === id ? { ...t, name } : t)).sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    },
    [templates, setTemplates],
  );

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    findByName,
    restoreTemplate,
    renameTemplate,
    isFull: templates.length >= MAX_TASK_TEMPLATES,
  };
}
