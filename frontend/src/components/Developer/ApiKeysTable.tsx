import { useState } from 'react';
import type { ApiKeySummary, ApiKeyScope } from '../../types/models';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import InlineRenameForm from '../UI/InlineRenameForm';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

interface ApiKeysTableProps {
  keys: ApiKeySummary[];
  onRevoke: (id: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
}

// Igual a API_KEY_NAME_MAX_LENGTH no backend.
const NAME_MAX_LENGTH = 100;

const SCOPE_LABEL_KEY: Record<ApiKeyScope, string> = {
  TASKS: 'ux4admin.keys.scopeTasks',
  ADMIN: 'ux4admin.keys.scopeAdmin',
};

const SCOPE_BADGE_BASE = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium border';
const SCOPE_BADGE_CLASS: Record<ApiKeyScope, string> = {
  ADMIN: `${SCOPE_BADGE_BASE} bg-amber-950/50 text-amber-400 border-amber-900/50`,
  TASKS: `${SCOPE_BADGE_BASE} bg-neutral-800 text-neutral-400 border-neutral-700`,
};

const HEADER_CELL = 'px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider';

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ApiKeysTable({ keys, onRevoke, onRename }: ApiKeysTableProps) {
  const { t, lang } = useI18n();
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const renderRename = (key: ApiKeySummary) => (
    <InlineRenameForm
      initial={key.name}
      label={t('ux4global.key.nameLabel')}
      maxLength={NAME_MAX_LENGTH}
      onCancel={() => setRenamingId(null)}
      onSave={async (name) => {
        await onRename(key.id, name);
        setRenamingId(null);
      }}
    />
  );

  const renderRenameButton = (key: ApiKeySummary) => (
    <IconButton label={t('ux4global.key.rename', { name: key.name })} onClick={() => setRenamingId(key.id)}>
      <PencilIcon />
    </IconButton>
  );

  const renderScope = (scope: ApiKeyScope) => (
    <span className={SCOPE_BADGE_CLASS[scope] ?? SCOPE_BADGE_CLASS.TASKS}>
      {SCOPE_LABEL_KEY[scope] ? t(SCOPE_LABEL_KEY[scope]) : scope}
    </span>
  );

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {keys.map((key) => (
          <li key={key.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {renamingId === key.id ? (
                  renderRename(key)
                ) : (
                  <p className="truncate text-sm font-medium text-white" title={key.name}>
                    {key.name}
                  </p>
                )}
                <div className="mt-1.5">{renderScope(key.scope)}</div>
              </div>
              <div className="flex shrink-0 items-center">
                {renamingId !== key.id && renderRenameButton(key)}
                <IconButton
                  label={t('ui.revokeKey')}
                  onClick={() => onRevoke(key.id)}
                  className="text-neutral-500 hover:text-red-400"
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-neutral-500">{t('ui.created')}</dt>
                <dd className="text-neutral-300">{formatDate(key.createdAt, lang)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t('ui.lastUsed')}</dt>
                <dd className="text-neutral-300">{key.lastUsed ? formatDate(key.lastUsed, lang) : t('ui.never')}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto border border-neutral-800 rounded-xl">
        <table className="min-w-full divide-y divide-neutral-800">
          <thead className="bg-neutral-900/50">
            <tr>
              <th className={HEADER_CELL}>{t('ui.name')}</th>
              <th className={HEADER_CELL}>{t('ui.scope')}</th>
              <th className={HEADER_CELL}>{t('ui.created')}</th>
              <th className={HEADER_CELL}>{t('ui.lastUsed')}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{t('ui.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {keys.map((key) => (
              <tr key={key.id} className="hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-white">
                  {renamingId === key.id ? renderRename(key) : key.name}
                </td>
                <td className="px-4 py-3 text-sm">{renderScope(key.scope)}</td>
                <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(key.createdAt, lang)}</td>
                <td className="px-4 py-3 text-sm text-neutral-400">
                  {key.lastUsed ? formatDate(key.lastUsed, lang) : t('ui.never')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {renderRenameButton(key)}
                  <IconButton
                    label={t('ui.revokeKey')}
                    onClick={() => onRevoke(key.id)}
                    className="text-neutral-500 hover:text-red-400"
                  >
                    <TrashIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
