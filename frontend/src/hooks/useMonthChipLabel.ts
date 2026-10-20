import { useCallback } from 'react';
import { MONTH_CHIP_FALLBACK_KEY, type MonthChip } from '../lib/monthAgenda';
import { useI18n } from '../i18n/useI18n';

/** Texto de um chip do mes: titulo, disciplina, nome do turno ou o texto por omissao do tom. */
export function useMonthChipLabel() {
  const { t } = useI18n();
  return useCallback(
    (chip: MonthChip) => {
      const fallbackKey = MONTH_CHIP_FALLBACK_KEY[chip.tone];
      return chip.label ?? (fallbackKey ? t(fallbackKey) : '');
    },
    [t],
  );
}
