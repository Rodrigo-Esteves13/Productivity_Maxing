import type { NotebookEntryType } from '../types/models';
import type { SegmentedOption } from '../components/UI/SegmentedControl';
import { BookOpenIcon, GraduationCapIcon, PencilIcon } from '../components/UI/Icons';
import { useI18n } from '../i18n/useI18n';

export const ENTRY_TYPE_ICON = {
  NOTE: PencilIcon,
  STUDY: BookOpenIcon,
  CLASS: GraduationCapIcon,
} as const;

// Tipos de entrada (Note/Study/Class) com labels traduzidas e icone.
export function useEntryTypeOptions(): SegmentedOption<NotebookEntryType>[] {
  const { t } = useI18n();
  return [
    { value: 'NOTE', label: t('notebook.type.note'), icon: ENTRY_TYPE_ICON.NOTE },
    { value: 'STUDY', label: t('notebook.type.study'), icon: ENTRY_TYPE_ICON.STUDY },
    { value: 'CLASS', label: t('notebook.type.class'), icon: ENTRY_TYPE_ICON.CLASS },
  ];
}
