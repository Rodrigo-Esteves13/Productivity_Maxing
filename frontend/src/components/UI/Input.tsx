import { useId, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, id, className = '', type, ...rest }: InputProps) {
  const { t } = useI18n();
  // Most call sites only pass `label`, not `id` (Login.tsx, TaskEditForm,
  // etc.) - without an id, htmlFor below has nothing to point at, so the
  // <label> and <input> are visually together but NOT programmatically
  // associated (screen readers can't tell they're linked, and
  // getByLabel() in tests/accessibility tooling can't find the field
  // either). useId() gives every Input a stable id for free when the
  // caller doesn't supply one, without requiring every call site to be
  // touched.
  const generatedId = useId();
  const resolvedId = id ?? generatedId;

  // Every type="password" Input (Login, Register, ResetPassword, Security)
  // gets a show/hide toggle for free - no call site needs to opt in. Local
  // state, not persisted anywhere; resets to hidden on remount as expected.
  const isPasswordField = type === 'password';
  const [isRevealed, setIsRevealed] = useState(false);
  const resolvedType = isPasswordField ? (isRevealed ? 'text' : 'password') : type;

  // Aviso de Caps Lock so em passwords: o estado vem do proprio evento de teclado.
  const [capsOn, setCapsOn] = useState(false);
  const { onKeyDown, onKeyUp, onBlur } = rest;
  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => isPasswordField && setCapsOn(e.getModifierState('CapsLock'));

  const field = (
    <input
      id={resolvedId}
      type={resolvedType}
      className={`w-full block border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-2.5 text-base placeholder:text-neutral-500 transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-smooth-out hover:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${isPasswordField ? 'pr-10' : ''} ${className}`}
      {...rest}
      onKeyDown={(e) => { trackCaps(e); onKeyDown?.(e); }}
      onKeyUp={(e) => { trackCaps(e); onKeyUp?.(e); }}
      onBlur={(e) => { setCapsOn(false); onBlur?.(e); }}
    />
  );

  const wrappedField = isPasswordField ? (
    <div>
      <div className="relative">
        {field}
        <button
          type="button"
          onClick={() => setIsRevealed((prev) => !prev)}
          // tabIndex=-1: a toggle button between two form fields would break
          // Tab-order flow (Password -> [toggle] -> Confirm Password), and a
          // sighted mouse/touch user doesn't need it in the tab sequence -
          // it's still reachable, just not in the way of keyboard form-filling.
          tabIndex={-1}
          aria-label={isRevealed ? t('ui.hidePassword') : t('ui.showPassword')}
          aria-pressed={isRevealed}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {capsOn && (
        <p role="status" className="mt-1 text-xs text-violet-300">{t('ui.capsLockOn')}</p>
      )}
    </div>
  ) : (
    field
  );

  if (!label) return wrappedField;

  return (
    <div>
      <label htmlFor={resolvedId} className="block text-sm font-medium text-neutral-300 mb-1">
        {label}
      </label>
      {wrappedField}
    </div>
  );
}
