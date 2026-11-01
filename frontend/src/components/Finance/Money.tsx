import { useEffect, useState } from 'react';
import { formatMoney } from '../../lib/money';
import { PRIVACY_MASK, PRIVACY_REVEAL_MS } from '../../lib/privacy';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

type MoneyFormatter = (cents: number, currency: string) => string;

interface PrivateTextProps {
  /** Monta o texto; `money` devolve o valor real ou a mascara. */
  render: (money: MoneyFormatter) => string;
  className?: string;
}

// Unico ponto onde um valor de dinheiro vira texto no ecra. Com o modo
// privacidade ligado mostra a mascara; clicar ou tocar revela ESTE valor
// durante PRIVACY_REVEAL_MS.
export function PrivateText({ render, className = '' }: PrivateTextProps) {
  const { t, lang } = useI18n();
  const { enabled } = usePrivacyMode();
  const [revealed, setRevealed] = useState(false);
  const hidden = enabled && !revealed;

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), PRIVACY_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  useEffect(() => {
    if (!enabled) setRevealed(false);
  }, [enabled]);

  if (!hidden) return <span className={className}>{render((cents, currency) => formatMoney(cents, currency, lang))}</span>;
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-label={t('finance.privacy.reveal')}
      title={t('finance.privacy.reveal')}
      className={`cursor-pointer rounded-sm bg-transparent p-0 text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${className}`}
    >
      {render(() => PRIVACY_MASK)}
    </button>
  );
}

interface MoneyProps {
  cents: number;
  currency: string;
  /** Texto antes do valor, por exemplo "+" (fica escondido com ele). */
  prefix?: string;
  className?: string;
}

export default function Money({ cents, currency, prefix = '', className }: MoneyProps) {
  return <PrivateText className={className} render={(money) => `${prefix}${money(cents, currency)}`} />;
}
