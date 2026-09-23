import type { UserStatus } from '../../types/models';

interface UserStatusBadgeProps {
  status: UserStatus | undefined;
  suspendedUntil?: string | null;
}

const STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  SUSPENDED: 'bg-amber-900/50 text-amber-400 border-amber-800',
  BANNED: 'bg-red-900/50 text-red-400 border-red-800',
};

export default function UserStatusBadge({ status, suspendedUntil }: UserStatusBadgeProps) {
  // status vem undefined em respostas que não passam por USER_ADMIN_SELECT
  // (ex: /auth/me) - nunca deveria acontecer nesta tabela, mas por defeito
  // não assumimos nada em vez de rebentar.
  const resolved = status ?? 'ACTIVE';

  return (
    <span className={`inline-flex flex-col items-center px-2 py-1 text-xs font-semibold rounded-full border ${STYLES[resolved]}`}>
      {resolved === 'SUSPENDED' ? 'SUSPENDED' : resolved}
      {resolved === 'SUSPENDED' && suspendedUntil && (
        <span className="text-[10px] font-normal normal-case text-amber-500">
          until {new Date(suspendedUntil).toLocaleDateString()}
        </span>
      )}
    </span>
  );
}
