import { useCallback, useContext } from 'react';
import { PrivacyModeContext, type PrivacyModeValue } from '../context/privacy-mode-context';
import { formatMoney } from '../lib/money';
import { PRIVACY_MASK } from '../lib/privacy';
import { useI18n } from '../i18n/useI18n';

export function usePrivacyMode(): PrivacyModeValue {
  return useContext(PrivacyModeContext);
}

/**
 * Formata dinheiro como texto. Com o modo privacidade ligado devolve sempre a
 * mascara (usar para aria-labels, eixos e tooltips de graficos, titulos).
 * Para valores no ecra que se podem revelar com um toque, usar <Money>.
 */
export function useMoneyText(): (cents: number, currency: string) => string {
  const { enabled } = usePrivacyMode();
  const { lang } = useI18n();
  return useCallback((cents, currency) => (enabled ? PRIVACY_MASK : formatMoney(cents, currency, lang)), [enabled, lang]);
}

// Classe para inputs de dinheiro que vem preenchido (edicao): os pontos so
// desaparecem enquanto o campo esta em foco.
const MASKED_INPUT_CLASS = '[-webkit-text-security:disc] focus:[-webkit-text-security:none]';

export function usePrivateInputClass(): string {
  return usePrivacyMode().enabled ? MASKED_INPUT_CLASS : '';
}
