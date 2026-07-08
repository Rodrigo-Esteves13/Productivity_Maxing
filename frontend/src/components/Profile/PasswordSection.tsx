import type { FormEvent } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import ActionButton from '../UI/ActionButton';

interface PasswordSectionProps {
  hasPassword: boolean;
  showPasswordFields: boolean;
  newPassword: string;
  confirmNewPassword: string;
  passwordError: string;
  passwordSuccess: boolean;
  isSavingPassword: boolean;
  onShowFields: () => void;
  onCancel: () => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function PasswordSection({
  hasPassword,
  showPasswordFields,
  newPassword,
  confirmNewPassword,
  passwordError,
  passwordSuccess,
  isSavingPassword,
  onShowFields,
  onCancel,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordSectionProps) {
  return (
    <div className="mt-6 pt-5 border-t border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">
        {hasPassword ? 'Change Password' : 'Add a Password'}
      </h3>

      {!hasPassword && !showPasswordFields && !passwordSuccess && (
        <p className="text-xs text-neutral-500 mb-3">
          Your account currently signs in only through a connected provider. Add a password to
          also be able to log in with your email.
        </p>
      )}

      {passwordSuccess && (
        <p className="text-sm text-green-400 mb-3">Password updated successfully.</p>
      )}

      {!showPasswordFields ? (
        <Button type="button" variant="secondary" onClick={onShowFields}>
          {hasPassword ? 'Change Password' : 'Add Password'}
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {passwordError && <FormError message={passwordError} />}

          <FormField label="New Password" htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
            />
          </FormField>

          <FormField label="Confirm New Password" htmlFor="confirm-new-password">
            <Input
              id="confirm-new-password"
              type="password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <ActionButton type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? 'Saving...' : 'Save Password'}
            </ActionButton>
          </div>
        </form>
      )}
    </div>
  );
}
