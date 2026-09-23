import UsersTableHeader from './UsersTableHeader';
import UserTableRow from './UserTableRow';
import type { User } from '../../types/models';

interface UsersTableProps {
  users: User[];
  currentUserId?: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onExport: (user: User) => void;
  onSuspend: (user: User) => void;
  onBan: (user: User) => void;
  onReactivate: (user: User) => void;
  reactivatingId: string | null;
}

export default function UsersTable({
  users,
  currentUserId,
  onEdit,
  onDelete,
  onExport,
  onSuspend,
  onBan,
  onReactivate,
  reactivatingId,
}: UsersTableProps) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <UsersTableHeader />
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onExport={onExport}
                  onSuspend={onSuspend}
                  onBan={onBan}
                  onReactivate={onReactivate}
                  isReactivating={reactivatingId === user.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
