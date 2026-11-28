import { useI18n } from '../../../i18n/useI18n';
import type { ShareAccessRole } from '../../../types/models';
import { ROLES, ROLE_KEY } from './shareRoles';

const SELECT_CLASS =
  'rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-200 focus:border-violet-500 focus:outline-none disabled:opacity-50';

export default function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: ShareAccessRole;
  disabled?: boolean;
  onChange: (role: ShareAccessRole) => void;
}) {
  const { t } = useI18n();
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={t('share.role.label')}
      onChange={(e) => onChange(e.target.value as ShareAccessRole)}
      className={SELECT_CLASS}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(ROLE_KEY[role])}
        </option>
      ))}
    </select>
  );
}
