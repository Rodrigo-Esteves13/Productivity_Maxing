import { useCallback, useMemo } from 'react';
import { useI18n } from '../i18n/useI18n';
import { seededCatalogKey, type CatalogKind } from '../lib/catalogLabel';
import { formatEnumLabel } from '../utils/formatEnumLabel';

interface KeyedOption {
  key: string;
  label: string;
}

export interface CatalogLabels {
  /** Rotulo de um item do catalogo na lingua da app (ver lib/catalogLabel.ts). */
  catalogLabel: (kind: CatalogKind, key: string, label: string | null | undefined) => string;
  /** Igual, mas procura o rotulo na lista de opcoes carregada (como resolveOptionLabel). */
  optionLabel: (
    kind: CatalogKind,
    key: string | null | undefined,
    options: KeyedOption[],
  ) => string | null;
}

export function useCatalogLabel(): CatalogLabels {
  const { t } = useI18n();
  const catalogLabel = useCallback<CatalogLabels['catalogLabel']>(
    (kind, key, label) => {
      const i18nKey = seededCatalogKey(kind, key, label);
      return i18nKey ? t(i18nKey) : (label ?? key);
    },
    [t],
  );
  const optionLabel = useCallback<CatalogLabels['optionLabel']>(
    (kind, key, options) => {
      if (!key) return null;
      const label = options.find((o) => o.key === key)?.label;
      // Opcao ainda nao carregada e fora dos semeados: mesmo fallback do
      // resolveOptionLabel, para nunca mostrar a key crua.
      if (label === undefined && !seededCatalogKey(kind, key, label)) return formatEnumLabel(key);
      return catalogLabel(kind, key, label);
    },
    [catalogLabel],
  );
  return useMemo(() => ({ catalogLabel, optionLabel }), [catalogLabel, optionLabel]);
}
