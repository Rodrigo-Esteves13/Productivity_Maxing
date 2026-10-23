import { useI18n } from '../../i18n/useI18n';
import type { TurmaRole } from '../../types/models';

const ROLE_STYLE: Record<TurmaRole, { key: string; className: string }> = {
  DELEGADO: { key: 'turma.role.delegado', className: 'border-violet-700 bg-violet-900/50 text-violet-300' },
  MEMBER: { key: 'turma.role.member', className: 'border-neutral-700 bg-neutral-800 text-neutral-300' },
};

export default function TurmaRoleBadge({ role }: { role: TurmaRole }) {
  const { t } = useI18n();
  const style = ROLE_STYLE[role];
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      {t(style.key)}
    </span>
  );
}
