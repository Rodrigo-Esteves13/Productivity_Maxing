import type { TaskPackItem, TaskPackItemEdit } from '../api/taskPackService';

// Tamanho de AAAA-MM-DD no inicio de uma data ISO.
export const ISO_DAY_LENGTH = 10;

export interface PackItemDraft {
  title: string;
  day: string;
  weight: string;
}

export const draftFromItem = (item: TaskPackItem): PackItemDraft => ({
  title: item.title,
  day: item.date.slice(0, ISO_DAY_LENGTH),
  weight: item.weightPercentage === null ? '' : String(item.weightPercentage),
});

/** So os campos que mudaram. A hora original da data e mantida. */
export function packItemChanges(item: TaskPackItem, draft: PackItemDraft): TaskPackItemEdit {
  const edit: TaskPackItemEdit = {};
  const title = draft.title.trim();
  if (title && title !== item.title) edit.title = title;
  if (draft.day && draft.day !== item.date.slice(0, ISO_DAY_LENGTH)) {
    edit.date = `${draft.day}${item.date.slice(ISO_DAY_LENGTH)}`;
  }
  const weight = draft.weight.trim() === '' ? null : Number(draft.weight);
  if (weight !== item.weightPercentage && !Number.isNaN(weight)) edit.weightPercentage = weight;
  return edit;
}
