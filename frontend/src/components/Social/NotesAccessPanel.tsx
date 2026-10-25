import { useState } from 'react';
import type { IncomingGrant, IncomingGrantsView } from '../../api/socialNotesService';
import { useI18n } from '../../i18n/useI18n';
import { friendPath } from '../../lib/appLinks';
import PersonRow from './PersonRow';
import { selectableGrantAreaIds } from '../../lib/notesAccess';

interface Props {
  view: IncomingGrantsView;
  /** So pedidos por decidir (separador Pedidos) ou so acessos dados (As minhas partilhas). */
  status: IncomingGrant['status'];
  title: string;
  onDecide: (grantId: string, approve: boolean, areaIds?: string[]) => Promise<boolean>;
  onUpdateAreas: (grantId: string, areaIds: string[]) => Promise<boolean>;
  onRevoke: (grantId: string) => Promise<boolean>;
}

const btn = 'text-sm text-neutral-400 hover:text-white';

/** Escolha de cadeiras: nada vem marcado por omissao (o dono escolhe de forma consciente). */
function AreaPicker({
  view,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  view: IncomingGrantsView;
  initial: string[];
  submitLabel: string;
  onSubmit: (areaIds: string[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mt-2 w-full space-y-2 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
      <p className="text-xs text-neutral-400">{t('social.notes.pickAreas')}</p>
      {view.areas.length === 0 ? (
        <p className="text-xs text-neutral-500">{t('social.notes.noAreas')}</p>
      ) : (
        <ul className="space-y-1">
          {view.areas.map((a) => (
            <li key={a.areaId}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={picked.includes(a.areaId)}
                  onChange={() => toggle(a.areaId)}
                />
                <span>{a.name}</span>
                <span className="text-xs text-neutral-500">
                  {t('social.notes.count', { count: a.entryCount })}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => void onSubmit(picked).then((ok) => ok && onCancel())}
          className="rounded-md bg-violet-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={btn}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

export default function NotesAccessPanel({ view, status, title, onDecide, onUpdateAreas, onRevoke }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const grants = view.grants.filter((g) => g.status === status);
  if (grants.length === 0) return null;

  const renderRow = (g: IncomingGrant) => (
    <li key={g.grantId} className="space-y-0">
      <ul>
        <PersonRow
          person={{ userId: g.viewerId, name: g.viewerName, avatarUrl: g.viewerAvatarUrl }}
          to={friendPath(g.viewerId)}
          subtitle={
            g.status === 'APPROVED'
              ? t('social.notes.canRead', { count: g.areaIds.length })
              : t('social.notes.wantsToRead')
          }
        >
          {g.status === 'PENDING' ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(open === g.grantId ? null : g.grantId)}
                className="rounded-md bg-violet-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-violet-500"
              >
                {t('social.accept')}
              </button>
              <button type="button" onClick={() => void onDecide(g.grantId, false)} className={btn}>
                {t('social.decline')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpen(open === g.grantId ? null : g.grantId)}
                className={btn}
              >
                {t('social.notes.changeAreas')}
              </button>
              <button
                type="button"
                onClick={() => void onRevoke(g.grantId)}
                className={`${btn} hover:text-red-400`}
              >
                {t('social.notes.revoke')}
              </button>
            </>
          )}
        </PersonRow>
      </ul>
      {open === g.grantId && (
        <AreaPicker
          view={view}
          // So ids que ainda aparecem como opcao: uma cadeira que deixou de
          // ter notas visiveis ficava marcada sem se ver, impossivel de
          // desmarcar, e o backend recusava a gravacao.
          initial={g.status === 'APPROVED' ? selectableGrantAreaIds(g.areaIds, view) : []}
          submitLabel={g.status === 'APPROVED' ? t('common.save') : t('social.notes.allow')}
          onSubmit={(ids) =>
            g.status === 'APPROVED' ? onUpdateAreas(g.grantId, ids) : onDecide(g.grantId, true, ids)
          }
          onCancel={() => setOpen(null)}
        />
      )}
    </li>
  );

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-xs text-neutral-500">{t('social.notes.readOnlyHint')}</p>
      <ul className="space-y-2">{grants.map(renderRow)}</ul>
    </section>
  );
}
