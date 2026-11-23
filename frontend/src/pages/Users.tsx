import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import Pagination from '../components/UI/Pagination';
import SearchField from '../components/UI/SearchField';
import SortDirectionButton from '../components/UI/SortDirectionButton';
import TableSkeleton from '../components/UI/TableSkeleton';
import UsersTable from '../components/Users/UsersTable';
import UserEditForm from '../components/Users/UserEditForm';
import UserStatusModal from '../components/Users/UserStatusModal';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useListSearch } from '../hooks/useListSearch';
import { useEnumLabel } from '../hooks/useEnumLabel';
import { useUsersPage } from '../hooks/useUsersPage';
import { useI18n } from '../i18n/useI18n';
import {
  ALL_FILTER,
  USERS_PAGE_SIZE,
  USER_ROLES,
  USER_SORT_KEYS,
  USER_STATUSES,
  filterUsers,
  pageSlice,
  sortUsers,
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
  const {
    users,
    reload,
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
  } = useUsersPage(currentUser?.id);

  const [roleFilter, setRoleFilter] = useState<AllOr<Role>>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<AllOr<UserStatus>>(ALL_FILTER);
  const [sortKey, setSortKey] = useState<UserSortKey>('name');
  const [direction, setDirection] = useState<SortDirection>(SORT_DEFAULT_DIRECTION.name);
  const [skip, setSkip] = useState(0);

  // Nome, email ou codigo de amigo (ex.: alguem denuncia um codigo).
  const { query, setQuery, filtered: searched, isFiltering } = useListSearch(users, (u) => [
    u.name,
    u.email,
    u.friendCode,
  ]);
  const isNarrowed = isFiltering || roleFilter !== ALL_FILTER || statusFilter !== ALL_FILTER;

  const matching = useMemo(
    () => sortUsers(filterUsers(searched, { role: roleFilter, status: statusFilter }), sortKey, direction),
    [searched, roleFilter, statusFilter, sortKey, direction],
  );
  const { rows: pageUsers, skip: pageSkip } = pageSlice(matching, skip, USERS_PAGE_SIZE);

  // Qualquer mudanca de pesquisa/filtro/ordem volta a primeira pagina.
  useEffect(() => setSkip(0), [query, roleFilter, statusFilter, sortKey, direction]);

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

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : users.length === 0 ? (
        <EmptyState message={t('ui.noUsersRegisteredInThe')} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <SearchField value={query} onChange={setQuery} label={t('adminSocial.search')} className="sm:max-w-sm" />
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
            {isNarrowed && (
              <span className="text-xs text-neutral-500" aria-live="polite">
                {t('search.count', { shown: matching.length, total: users.length })}
              </span>
            )}
          </div>
          {matching.length === 0 ? (
            <EmptyState
              message={isFiltering ? t('search.noResultsFor', { query: query.trim() }) : t('ux4adm2.users.noMatch')}
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  {t('ux4adm2.users.clearFilters')}
                </Button>
              }
            />
          ) : (
            <>
              <UsersTable
                users={pageUsers}
                currentUserId={currentUser?.id}
                onEdit={setEditingUser}
                onDelete={handleDeleteUser}
                onExport={handleExportUser}
                onSuspend={(user) => openStatusModal(user, 'suspend')}
                onBan={(user) => openStatusModal(user, 'ban')}
                onReactivate={handleReactivateUser}
                reactivatingId={reactivatingId}
              />
              <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
                <Pagination
                  total={matching.length}
                  skip={pageSkip}
                  pageSize={USERS_PAGE_SIZE}
                  onNextPage={() => setSkip(pageSkip + USERS_PAGE_SIZE)}
                  onPrevPage={() => setSkip(Math.max(0, pageSkip - USERS_PAGE_SIZE))}
                />
              </div>
            </>
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
