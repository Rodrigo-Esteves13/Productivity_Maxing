import { Link } from 'react-router-dom';
import type { SharedWithMeItem, SharedWithMeRole, SharedWithMeStatus } from '../../api/notebookService';
import { useI18n } from '../../i18n/useI18n';

const STATUS_STYLE: Record<SharedWithMeStatus, string> = {
  APPROVED: 'bg-cyan-900/50 text-cyan-300 border-cyan-800',
  PUBLIC: 'bg-sky-900/50 text-sky-300 border-sky-800',
  PENDING: 'bg-amber-900/50 text-amber-300 border-amber-800',
  DENIED: 'bg-red-900/50 text-red-300 border-red-800',
};

const ROLE_KEY: Record<SharedWithMeRole, string> = {
  VIEWER: 'sharedWithMe.role.viewer',
  EDITOR: 'sharedWithMe.role.editor',
  CO_OWNER: 'sharedWithMe.role.coOwner',
};

// Cor vem do servidor (colorHex da Area): so se aceita #rgb/#rrggbb, nunca
// texto livre dentro de um style.
const isHexColor = (value: string | null): value is string =>
  value !== null && /^#[0-9a-fA-F]{3,8}$/.test(value);

export default function SharedWithMeList({ items }: { items: SharedWithMeItem[] }) {
  const { t, lang } = useI18n();

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const accessible = item.status === 'APPROVED' || item.status === 'PUBLIC';
        return (
          <li key={item.token}>
            <Link
              to={`/shared/${item.token}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-violet-700"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {accessible && item.title ? item.title : t('sharedWithMe.hiddenTitle')}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  {item.areaName && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: isHexColor(item.areaColor) ? item.areaColor : '#808080' }}
                      />
                      {item.areaName}
                    </span>
                  )}
                  {item.ownerName && <span>{t('sharedWithMe.by', { name: item.ownerName })}</span>}
                  <span>{new Date(item.lastActivityAt).toLocaleDateString(lang)}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}
                >
                  {t(`sharedWithMe.status.${item.status.toLowerCase()}`)}
                </span>
                {item.status === 'APPROVED' && (
                  <span className="text-xs text-neutral-400">{t(ROLE_KEY[item.role])}</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
