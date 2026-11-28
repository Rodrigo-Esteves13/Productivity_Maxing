import { Link } from 'react-router-dom';
import { PencilIcon, TrashIcon, DownloadIcon, ClockIcon, ShieldIcon, CheckIcon, NetworkIcon } from '../UI/Icons';
import { adminUserPath } from '../../lib/appLinks';
import type { User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

export interface UserRowHandlers {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onExport: (user: User) => void;
  onSuspend: (user: User) => void;
  onBan: (user: User) => void;
  onReactivate: (user: User) => void;
}

interface UserRowActionsProps extends UserRowHandlers {
  user: User;
  isSelf: boolean;
  isReactivating: boolean;
}

const DISABLED_CLASS = 'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400';

// Botoes de acao de um utilizador: usados na linha da tabela (desktop) e no
// cartao (mobile), para as duas vistas terem sempre as mesmas acoes.
export default function UserRowActions({
  user,
  isSelf,
  isReactivating,
  onEdit,
  onDelete,
  onExport,
  onSuspend,
  onBan,
  onReactivate,
}: UserRowActionsProps) {
  const { t } = useI18n();
  const status = user.status ?? 'ACTIVE';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {status === 'ACTIVE' ? (
        <>
          <IconButton
            label={isSelf ? t('ui.youCantSuspendYourOwn') : t('ui.suspendUser')}
            onClick={() => onSuspend(user)}
            disabled={isSelf}
            className={`text-neutral-400 hover:text-amber-400 ${DISABLED_CLASS}`}
          >
            <ClockIcon className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={isSelf ? t('ui.youCantBanYourOwn') : t('ui.banUser')}
            onClick={() => onBan(user)}
            disabled={isSelf}
            className={`text-neutral-400 hover:text-red-500 ${DISABLED_CLASS}`}
          >
            <ShieldIcon className="h-4 w-4" />
          </IconButton>
        </>
      ) : (
        <IconButton
          label={t('ui.restoreToActive')}
          onClick={() => onReactivate(user)}
          disabled={isReactivating}
          className="text-neutral-400 hover:text-violet-400 disabled:opacity-30"
        >
          <CheckIcon className="h-4 w-4" />
        </IconButton>
      )}
      <Link
        to={adminUserPath(user.id)}
        title={t('adminSocial.open')}
        aria-label={t('adminSocial.open')}
        className="press inline-flex min-h-10 min-w-10 items-center justify-center rounded-md p-2 text-neutral-400 hover:bg-neutral-800/60 hover:text-violet-300 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <NetworkIcon className="h-4 w-4" />
      </Link>
      <IconButton label={t('ui.exportData')} onClick={() => onExport(user)} className="text-neutral-400 hover:text-white">
        <DownloadIcon />
      </IconButton>
      <IconButton label={t('ui.editUser')} onClick={() => onEdit(user)} className="text-neutral-400 hover:text-white">
        <PencilIcon />
      </IconButton>
      <IconButton
        label={isSelf ? t('ui.youCantDeleteYourOwn') : t('ui.deleteUser')}
        onClick={() => onDelete(user)}
        disabled={isSelf}
        className={`text-neutral-400 hover:text-red-500 ${DISABLED_CLASS}`}
      >
        <TrashIcon />
      </IconButton>
    </div>
  );
}
