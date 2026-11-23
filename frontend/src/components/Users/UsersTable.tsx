import UsersTableHeader from './UsersTableHeader';
import UserTableRow from './UserTableRow';
import UserCard from './UserCard';
import type { UserRowHandlers } from './UserRowActions';
import type { User } from '../../types/models';

interface UsersTableProps extends UserRowHandlers {
  users: User[];
  currentUserId?: string;
  reactivatingId: string | null;
}

// Cartoes em ecras estreitos, tabela a partir de md. As acoes sao as mesmas.
export default function UsersTable({ users, currentUserId, reactivatingId, ...handlers }: UsersTableProps) {
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            isSelf={user.id === currentUserId}
            isReactivating={reactivatingId === user.id}
            {...handlers}
          />
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
            <UsersTableHeader />
            <tbody>
              {users.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                  isReactivating={reactivatingId === user.id}
                  {...handlers}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
