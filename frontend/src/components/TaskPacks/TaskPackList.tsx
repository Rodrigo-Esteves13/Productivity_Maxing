import { useState } from 'react';
import { packShareUrl, type PackSyncResult, type TaskPackSummary } from '../../api/taskPackService';
import { useI18n } from '../../i18n/useI18n';

interface Props {
  packs: TaskPackSummary[];
  onDelete: (id: string) => Promise<boolean>;
  onPublish: (id: string) => Promise<PackSyncResult | null>;
}

export default function TaskPackList({ packs, onDelete, onPublish }: Props) {
  const { t, lang } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // Resultado do ultimo "Publish updates" por pacote (texto ja traduzido).
  const [publishNote, setPublishNote] = useState<Record<string, string>>({});

  const publish = async (pack: TaskPackSummary) => {
    setPublishingId(pack.id);
    const result = await onPublish(pack.id);
    setPublishingId(null);
    const note = !result
      ? t('packs.publish.error')
      : result.updatedItems === 0
        ? t('packs.publish.nothing')
        : t('packs.publish.done', { items: result.updatedItems, requests: result.proposalsCreated });
    setPublishNote((prev) => ({ ...prev, [pack.id]: note }));
  };

  const copy = async (pack: TaskPackSummary) => {
    try {
      await navigator.clipboard.writeText(packShareUrl(pack.code));
      setCopiedId(pack.id);
      window.setTimeout(() => setCopiedId((c) => (c === pack.id ? null : c)), 2000);
    } catch {
      // sem permissao de clipboard: o link continua visivel para copiar a mao
    }
  };

  return (
    <ul className="space-y-3">
      {packs.map((pack) => (
        <li key={pack.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{pack.name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {t('packs.list.meta', {
                  items: t(pack.itemCount === 1 ? 'packs.list.itemsOne' : 'packs.list.itemsMany', { count: pack.itemCount }),
                  imports: t(pack.importCount === 1 ? 'packs.list.importsOne' : 'packs.list.importsMany', {
                    count: pack.importCount,
                  }),
                  date: new Date(pack.createdAt).toLocaleDateString(lang),
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copy(pack)}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                {copiedId === pack.id ? t('packs.list.copied') : t('packs.list.copy')}
              </button>
              <button
                type="button"
                onClick={() => void publish(pack)}
                disabled={publishingId === pack.id}
                title={t('packs.publish.help')}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
              >
                {publishingId === pack.id ? t('packs.publish.publishing') : t('packs.publish.button')}
              </button>
              {confirmId === pack.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onDelete(pack.id)}
                    className="rounded-md bg-red-600/80 px-3 py-1.5 text-sm text-white hover:bg-red-600"
                  >
                    {t('packs.list.confirmDelete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-sm text-neutral-400 hover:text-white"
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(pack.id)}
                  className="text-sm text-neutral-400 hover:text-red-400"
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 break-all text-xs text-neutral-600">{packShareUrl(pack.code)}</p>
          {publishNote[pack.id] && (
            <p role="status" className="mt-2 text-xs text-violet-300">
              {publishNote[pack.id]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
