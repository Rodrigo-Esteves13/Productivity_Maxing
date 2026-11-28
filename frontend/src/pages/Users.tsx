import { useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import SearchField from '../components/UI/SearchField';
import SortDirectionButton from '../components/UI/SortDirectionButton';
import TableSkeleton from '../components/UI/TableSkeleton';
import UsersTable from '../components/Users/UsersTable';
import UserEditForm from '../components/Users/UserEditForm';
import UserStatusModal from '../components/Users/UserStatusModal';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useEnumLabel } from '../hooks/useEnumLabel';
import { useUsersPage } from '../hooks/useUsersPage';
import { useI18n } from '../i18n/useI18n';
import {
  ALL_FILTER,
  USER_ROLES,
  USER_SEARCH_DEBOUNCE_MS,
  USER_SEARCH_MAX_LENGTH,
  USER_SORT_KEYS,
  USER_STATUSES,
  filterUsers,
  type AllOr,
  type UserSortKey,
} from '../lib/adminLists';
import { flipDirection, type SortDirection } from '../lib/sortDirection';
import type { Role, UserStatus } from '../types/models';

const SORT_LABEL_KEY: Record<UserSortKey, string> = {
  name: 'ux4adm2.users.sortName',
  joined: 'ui.joined',
};
// Cada chave comeca no sentido mais util: nomes de A a Z, adesoes mais recentes primeiro.
const SORT_DEFAULT_DIRECTION: Record<UserSortKey, SortDirection> = { name: 'asc', joined: 'desc' };

export default function Users() {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  useDocumentTitle(t('ui.userManagementTitle'));
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AllOr<Role>>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<AllOr<UserStatus>>(ALL_FILTER);
  const [sortKey, setSortKey] = useState<UserSortKey>('name');
  const [direction, setDirection] = useState<SortDirection>(SORT_DEFAULT_DIRECTION.name);
  // Nome, email ou codigo de amigo (ex.: alguem denuncia um codigo).
  const search = useDebouncedValue(query, USER_SEARCH_DEBOUNCE_MS);

  const {
    users,
    reload,
    hasMore,
    isLoadingMore,
    loadMore,
    isLoading,
    error,
    editingUser,
    isSubmitting,
    exportingId,
    setEditingUser,
    handleEditUser,
    handleDeleteUser,
    handleExportUser,
    statusActionTarget,
    statusActionMode,
    isSubmittingStatus,
    reactivatingId,
    openStatusModal,
    closeStatusModal,
    handleSubmitStatusAction,
    handleReactivateUser,
  } = useUsersPage(currentUser?.id, {
    search,
    role: roleFilter,
    status: statusFilter,
    sortKey,
    direction,
  });

  const isSearching = search.trim().length > 0;
  const isNarrowed = isSearching || roleFilter !== ALL_FILTER || statusFilter !== ALL_FILTER;

  // O filtro repete-se aqui para uma linha editada (ex.: banida) sair logo da
  // lista; a ordem vem do servidor.
  const matching = useMemo(
    () => filterUsers(users, { role: roleFilter, status: statusFilter }),
    [users, roleFilter, statusFilter],
  );

  const changeSortKey = (key: UserSortKey) => {
    setSortKey(key);
    setDirection(SORT_DEFAULT_DIRECTION[key]);
  };
  const clearFilters = () => {
    setQuery('');
    setRoleFilter(ALL_FILTER);
    setStatusFilter(ALL_FILTER);
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.userManagement')}
        description={t('ui.areaExclusiveToAdministratorsTo')}
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SearchField
          value={query}
          onChange={(value) => setQuery(value.slice(0, USER_SEARCH_MAX_LENGTH))}
          label={t('adminSocial.search')}
          className="sm:max-w-sm"
        />
        <Select
          label={t('ui.role')}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as AllOr<Role>)}
        >
          <option value={ALL_FILTER}>{t('ux4adm2.users.allRoles')}</option>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {enumLabel(role)}
            </option>
          ))}
        </Select>
        <Select
          label={t('ui.status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AllOr<UserStatus>)}
        >
          <option value={ALL_FILTER}>{t('ux4adm2.users.allStatuses')}</option>
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {enumLabel(status)}
            </option>
          ))}
        </Select>
        <Select
          label={t('ux4adm2.users.sortBy')}
          value={sortKey}
          onChange={(e) => changeSortKey(e.target.value as UserSortKey)}
        >
          {USER_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(SORT_LABEL_KEY[key])}
            </option>
          ))}
        </Select>
        <SortDirectionButton
          direction={direction}
          onToggle={() => setDirection(flipDirection)}
          ascLabel={t('ux4adm2.sort.asc')}
          descLabel={t('ux4adm2.sort.desc')}
        />
        {!isLoading && !error && matching.length > 0 && (
          <span className="text-xs text-neutral-500" aria-live="polite">
            {t('fase5users.loaded', { count: matching.length })}
          </span>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <>
          {matching.length > 0 ? (
            <UsersTable
              users={matching}
              currentUserId={currentUser?.id}
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
              onExport={handleExportUser}
              onSuspend={(user) => openStatusModal(user, 'suspend')}
              onBan={(user) => openStatusModal(user, 'ban')}
              onReactivate={handleReactivateUser}
              reactivatingId={reactivatingId}
            />
          ) : isNarrowed ? (
            <EmptyState
              message={isSearching ? t('search.noResultsFor', { query: search.trim() }) : t('ux4adm2.users.noMatch')}
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  {t('ux4adm2.users.clearFilters')}
                </Button>
              }
            />
          ) : (
            !hasMore && <EmptyState message={t('ui.noUsersRegisteredInThe')} />
          )}
          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? t('fase5users.loading') : t('fase5users.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      {exportingId && <p className="mt-3 text-xs text-neutral-500">{t('ui.preparingExport')}</p>}

      <Modal isOpen={editingUser !== null} onClose={() => setEditingUser(null)} title={t('ui.editUser2')}>
        {editingUser && (
          <UserEditForm
            idPrefix="edit-user"
            initialValues={{ name: editingUser.name ?? '', role: editingUser.role }}
            isSelf={editingUser.id === currentUser?.id}
            onSubmit={handleEditUser}
            onCancel={() => setEditingUser(null)}
            isSubmitting={isSubmitting}
          />
        )}
      </Modal>

      <Modal
        isOpen={statusActionTarget !== null}
        onClose={closeStatusModal}
        title={statusActionMode === 'ban' ? t('ui.banUser2') : t('ui.suspendUser2')}
      >
        {statusActionTarget && statusActionMode && (
          <UserStatusModal
            target={statusActionTarget}
            mode={statusActionMode}
            isSubmitting={isSubmittingStatus}
            onSubmit={handleSubmitStatusAction}
            onCancel={closeStatusModal}
          />
        )}
      </Modal>
    </PageLayout>
  );
}
