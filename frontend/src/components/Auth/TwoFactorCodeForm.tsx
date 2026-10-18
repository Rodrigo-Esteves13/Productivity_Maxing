import { useState, type SyntheticEvent } from 'react';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { twoFactorLoginRequest } from '../../api/userService';
import { getApiMessage } from '../../lib/httpError';
import { useI18n } from '../../i18n/useI18n';

interface TwoFactorCodeFormProps {
  // Token curto devolvido pelo login (ou pelo redirect OAuth, no fragmento).
  token: string;
  onSuccess: (csrfToken: string) => void;
}

// Segundo passo do login: codigo da app autenticadora, ou um codigo de
// recuperacao (xxxxx-xxxxx).
export default function TwoFactorCodeForm({ token, onSuccess }: TwoFactorCodeFormProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { csrfToken } = await twoFactorLoginRequest(token, code.trim());
      onSuccess(csrfToken);
    } catch (err) {
      setError(getApiMessage(err, t('auth.twoFactor.invalidCode')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-neutral-400">
        {t('auth.twoFactorHelp')}
      </p>
      {error && <FormError message={error} />}
      <input
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={32}
        placeholder="123456"
        aria-label={t('auth.twoFactor.codeLabel')}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-center text-lg tracking-widest text-neutral-100 focus:outline-none focus:border-violet-600"
      />
      <Button type="submit" className="w-full" disabled={isSubmitting || code.trim().length < 6}>
        {isSubmitting ? t('auth.checking') : t('auth.verify')}
      </Button>
    </form>
  );
}
