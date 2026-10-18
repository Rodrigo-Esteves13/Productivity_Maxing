import { useCallback } from 'react';
import { useI18n } from '../i18n/useI18n';
import { formatEnumLabel } from '../utils/formatEnumLabel';

// Rotulo traduzido de um valor de enum guardado na BD (VERY_EASY, ON_TRACK...).
// Chave `enum.<VALOR>`; se ainda nao existir traducao, cai no formato antigo
// ("Very Easy"), por isso um enum novo nunca mostra uma chave crua.
export function useEnumLabel(): (value: string | null | undefined) => string {
  const { t } = useI18n();
  return useCallback(
    (value) => {
      if (!value) return t('common.na');
      const key = `enum.${value}`;
      const label = t(key);
      return label === key ? formatEnumLabel(value) : label;
    },
    [t],
  );
}
