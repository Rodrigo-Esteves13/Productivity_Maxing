import type { Role } from '../../types/models';
import { useEnumLabel } from '../../hooks/useEnumLabel';

interface RoleBadgeProps {
  role: Role;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const enumLabel = useEnumLabel();
  const styles: Record<Role, string> = {
    ADMIN: 'bg-amber-900/50 text-amber-400 border-amber-800',
    USER: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${styles[role]}`}>
      {enumLabel(role)}
    </span>
  );
}
