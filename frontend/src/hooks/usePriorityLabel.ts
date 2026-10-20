import { useCallback } from 'react';
import { useI18n } from '../i18n/useI18n';
import { seededPriorityKey } from '../lib/priorityLabel';

/** Rotulo de uma prioridade na lingua da app (ver lib/priorityLabel.ts). */
export function usePriorityLabel(): (key: string, label: string | null | undefined) => string {
  const { t } = useI18n();
  return useCallback(
    (key, label) => {
      const i18nKey = seededPriorityKey(key, label);
      return i18nKey ? t(i18nKey) : (label ?? key);
    },
    [t],
  );
}
