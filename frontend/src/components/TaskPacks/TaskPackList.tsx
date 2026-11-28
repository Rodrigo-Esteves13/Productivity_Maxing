import { useRef, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { packShareUrl, type PackSyncResult, type TaskPackSummary } from '../../api/taskPackService';
import { useI18n } from '../../i18n/useI18n';
import EditPackItemsModal from './EditPackItemsModal';
import type { Area, Task } from '../../types/models';

interface Props {
  packs: TaskPackSummary[];
  tasks: Task[];
  areas: Area[];
  onItemCount: (id: string, count: number) => void;
  onTasksChanged: () => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onPublish: (id: string) => Promise<PackSyncResult | null>;
}

const MAX_NAME_LENGTH = 80;

export default function TaskPackList({
  packs,
  tasks,
  areas,
  onDelete,
  onRename,
  onPublish,
  onItemCount,
  onTasksChanged,
}: Props) {
  const { t, lang } = useI18n();
  const [renaming, setRenaming] = useState<TaskPackSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editing, setEditing] = useState<TaskPackSummary | null>(null);
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  // Links por pacote: para os selecionar quando o clipboard nao deixa copiar.
  const linkRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // Resultado do ultimo "Publish updates" por pacote (texto ja traduzido).
  const [publishNote, setPublishNote] = useState<Record<string, string>>({});
  // Falhas de apagar e de copiar o link: ficam visiveis no proprio cartao.
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const setRowMessage = (id: string, message: string | null) =>
    setRowError((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });

  const remove = async (pack: TaskPackSummary) => {
    setRowMessage(pack.id, null);
    const ok = await onDelete(pack.id);
    if (ok) setConfirmId(null);
    else setRowMessage(pack.id, t('quickWins.packDeleteError'));
  };

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
    setRowMessage(pack.id, null);
    try {
      await navigator.clipboard.writeText(packShareUrl(pack.code));
      setCopiedId(pack.id);
      window.setTimeout(() => setCopiedId((c) => (c === pack.id ? null : c)), 2000);
    } catch {
      // sem permissao de clipboard: seleciona o texto do link para copiar a mao
      const link = linkRefs.current[pack.id];
      const selection = window.getSelection();
      if (link && selection) {
        const range = document.createRange();
        range.selectNodeContents(link);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setRowMessage(pack.id, t('quickWins.packCopyError'));
    }
  };

  const openRename = (pack: TaskPackSummary) => {
    setRenaming(pack);
    setRenameValue(pack.name);
    setRenameError('');
  };

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return setRenameError(t('packs.create.needName'));
    if (name === renaming.name) return setRenaming(null);
    setIsRenaming(true);
    const ok = await onRename(renaming.id, name);
    setIsRenaming(false);
    if (ok) setRenaming(null);
    else setRenameError(t('ux4packs.rename.error'));
  };

  return (
    <>
    <ul className="space-y-3">
      {packs.map((pack) => (
        <li key={pack.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-white" title={pack.name}>{pack.name}</p>
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
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 pointer-coarse:min-h-11"
              >
                {copiedId === pack.id ? t('packs.list.copied') : t('packs.list.copy')}
              </button>
              <button
                type="button"
                onClick={() => openRename(pack)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 pointer-coarse:min-h-11"
              >
                {t('ux4packs.rename.button')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(pack)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 pointer-coarse:min-h-11"
              >
                {t('f7Study.packs.editTasks')}
              </button>
              <button
                type="button"
                onClick={() => void publish(pack)}
                disabled={publishingId === pack.id}
                title={t('packs.publish.help')}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-50 pointer-coarse:min-h-11"
              >
                {publishingId === pack.id ? t('packs.publish.publishing') : t('packs.publish.button')}
              </button>
              {confirmId === pack.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => void remove(pack)}
                    className="rounded-md bg-red-600/80 px-3 py-1.5 text-sm text-white hover:bg-red-600 pointer-coarse:min-h-11"
                  >
                    {t('packs.list.confirmDelete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-sm text-neutral-400 hover:text-white pointer-coarse:min-h-11 pointer-coarse:px-2"
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(pack.id)}
                  className="text-sm text-neutral-400 hover:text-red-400 pointer-coarse:min-h-11 pointer-coarse:px-2"
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
          <p
            ref={(el) => {
              linkRefs.current[pack.id] = el;
            }}
            className="mt-2 break-all text-xs text-neutral-500 select-all"
          >
            {packShareUrl(pack.code)}
          </p>
          {rowError[pack.id] && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {rowError[pack.id]}
            </p>
          )}
          {publishNote[pack.id] && (
            <p role="status" className="mt-2 text-xs text-violet-300">
              {publishNote[pack.id]}
            </p>
          )}
        </li>
      ))}
    </ul>
    <Modal isOpen={renaming !== null} onClose={() => setRenaming(null)} title={t('ux4packs.rename.title')}>
      <form onSubmit={(e) => void submitRename(e)} className="space-y-4">
        <p className="text-sm text-neutral-400">{t('ux4packs.rename.intro')}</p>
        <Input
          label={t('packs.create.name')}
          value={renameValue}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        {renameError && <FormError message={renameError} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isRenaming}>
            {isRenaming ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
    {editing && (
      <EditPackItemsModal
        key={editing.id}
        pack={editing}
        tasks={tasks}
        areas={areas}
        onClose={() => setEditing(null)}
        onItemCount={onItemCount}
        onTasksChanged={onTasksChanged}
      />
    )}
    </>
  );
}
