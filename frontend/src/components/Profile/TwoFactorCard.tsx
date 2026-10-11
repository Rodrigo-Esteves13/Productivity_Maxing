import { useState } from 'react';
import type { User } from '../../types/models';
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor } from '../../api/userService';
import { getApiMessage } from '../../lib/httpError';
import { useFeedback } from '../../context/useFeedback';
import CopyButton from '../UI/CopyButton';
import FormError from '../UI/FormError';

interface TwoFactorCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'setup'; secret: string; otpauthUri: string }
  | { kind: 'codes'; recoveryCodes: string[] }
  | { kind: 'disable' };

// 2FA por app autenticadora. So aparece quando o backend tem o 2FA ligado
// (user.twoFactorAvailable); enquanto estiver desligado nao se renderiza nada.
export default function TwoFactorCard({ user, onUserUpdate }: TwoFactorCardProps) {
  const { notify } = useFeedback();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  if (!user.twoFactorAvailable) return null;
  const enabled = user.twoFactorEnabled ?? false;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setIsBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getApiMessage(err, fallback));
    } finally {
      setIsBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const { secret, otpauthUri } = await beginTwoFactorSetup();
      setCode('');
      setStep({ kind: 'setup', secret, otpauthUri });
    }, 'Could not start the setup.');

  const confirm = () =>
    run(async () => {
      const { recoveryCodes } = await confirmTwoFactorSetup(code.trim());
      onUserUpdate({ ...user, twoFactorEnabled: true });
      setCode('');
      setStep({ kind: 'codes', recoveryCodes });
    }, 'Invalid code.');

  const disable = () =>
    run(async () => {
      await disableTwoFactor(code.trim());
      onUserUpdate({ ...user, twoFactorEnabled: false });
      setCode('');
      setStep({ kind: 'idle' });
      notify('Two-factor authentication turned off.', 'success');
    }, 'Invalid code.');

  const inputClass =
    'w-full max-w-xs rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-violet-600';

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white mb-1">Two-factor authentication</h2>
      <p className="text-sm text-neutral-400 mb-3">
        Ask for a code from an authenticator app (Google Authenticator, Authy, 1Password) at every login,
        including Google, GitHub and Discord sign-in.
      </p>
      {error && <FormError message={error} />}

      {step.kind === 'idle' && !enabled && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void startSetup()}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          Set up
        </button>
      )}

      {step.kind === 'idle' && enabled && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-violet-300">On</span>
          <button
            type="button"
            onClick={() => {
              setCode('');
              setError('');
              setStep({ kind: 'disable' });
            }}
            className="text-sm text-neutral-400 hover:text-red-400"
          >
            Turn off
          </button>
        </div>
      )}

      {step.kind === 'setup' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">
            In your authenticator app, add an account by entering this key manually, then type the 6-digit
            code it shows.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200">
              {step.secret}
            </code>
            <CopyButton text={step.secret} />
          </div>
          <p className="text-xs text-neutral-500 break-all">
            Or open this link on your phone: <a className="underline text-violet-400" href={step.otpauthUri}>setup link</a>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            aria-label="6-digit code"
            className={inputClass}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isBusy || code.length !== 6}
              onClick={() => void confirm()}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
            >
              Turn on
            </button>
            <button type="button" onClick={() => setStep({ kind: 'idle' })} className="text-sm text-neutral-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step.kind === 'codes' && (
        <div className="space-y-3">
          <p className="text-sm text-amber-300">
            Save these recovery codes now. Each works once if you lose your phone. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {step.recoveryCodes.map((c) => (
              <code key={c} className="rounded bg-neutral-950 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 text-center">
                {c}
              </code>
            ))}
          </div>
          <CopyButton text={step.recoveryCodes.join('\n')} label="Copy all" />
          <div>
            <button type="button" onClick={() => setStep({ kind: 'idle' })} className="text-sm text-violet-400 hover:text-violet-300 underline">
              I saved them
            </button>
          </div>
        </div>
      )}

      {step.kind === 'disable' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">Enter a code from your app (or a recovery code) to turn it off.</p>
          <input
            type="text"
            autoComplete="one-time-code"
            maxLength={32}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Authentication code"
            className={inputClass}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isBusy || code.trim().length < 6}
              onClick={() => void disable()}
              className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
            >
              Turn off
            </button>
            <button type="button" onClick={() => setStep({ kind: 'idle' })} className="text-sm text-neutral-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
