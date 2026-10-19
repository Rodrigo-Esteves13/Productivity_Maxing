import type { SyntheticEvent } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import ActionButton from '../UI/ActionButton';
import { useI18n } from '../../i18n/useI18n';

interface PasswordSectionProps {
  hasPassword: boolean;
  showPasswordFields: boolean;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  passwordError: string;
  passwordSuccess: boolean;
  isSavingPassword: boolean;
  onShowFields: () => void;
  onCancel: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
}

export default function PasswordSection({
  hasPassword,
  showPasswordFields,
  currentPassword,
  newPassword,
  confirmNewPassword,
  passwordError,
  passwordSuccess,
  isSavingPassword,
  onShowFields,
  onCancel,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordSectionProps) {
  const { t } = useI18n();
  return (
    <div className="mt-6 pt-5 border-t border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">
        {hasPassword ? t('ui.changePassword') : t('ui.addAPassword')}
      </h3>

      {!hasPassword && !showPasswordFields && !passwordSuccess && (
        <p className="text-xs text-neutral-500 mb-3">
          {t('ui.yourAccountCurrentlySignsIn')}
        </p>
      )}

      {passwordSuccess && (
        <p className="text-sm text-violet-300 mb-3">{t('ui.passwordUpdatedSuccessfully')}</p>
      )}

      {!showPasswordFields ? (
        <Button type="button" variant="secondary" onClick={onShowFields}>
          {hasPassword ? t('ui.changePassword') : t('ui.addPassword')}
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {passwordError && <FormError message={passwordError} />}

          {hasPassword && (
            <FormField label={t('ui.currentPassword')} htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
              />
            </FormField>
          )}

          <FormField label={t('ui.newPassword')} htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
            />
          </FormField>

          <FormField label={t('ui.confirmNewPassword')} htmlFor="confirm-new-password">
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t('ui.cancel')}
            </Button>
            <ActionButton type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? t('common.saving') : t('ui.savePassword')}
            </ActionButton>
          </div>
        </form>
      )}
    </div>
  );
}
