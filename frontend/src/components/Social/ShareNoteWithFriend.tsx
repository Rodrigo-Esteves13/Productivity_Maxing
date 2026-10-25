import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inviteFriendToEntry, searchNotebook } from '../../api/notebookService';
import { getApiCode, getHttpStatus } from '../../lib/httpError';
import { notebookEntryPath } from '../../lib/appLinks';
import { notifySocialChanged } from '../../lib/socialEvents';
import { areaColorOf } from '../SharedWithMe/sharedWithMeLabels';
import type { NotebookSearchResult, ShareAccessRole } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

const SEARCH_DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;
const HTTP_CONFLICT = 409;
// Codigos que o backend poe nos 409 do convite (notebook-invite.service.ts).
// Sem codigo (backend antigo) assume-se o caso do link publico.
const INVITE_CONFLICT_KEY: Record<string, string> = {
  INVITE_NOTE_FULL: 'friend.share.noteFull',
  INVITE_DECLINED_RECENTLY: 'friend.share.declinedRecently',
};
const ROLES: ShareAccessRole[] = ['EDITOR', 'CO_OWNER', 'VIEWER'];
const ROLE_KEY: Record<ShareAccessRole, string> = {
  VIEWER: 'share.role.viewer',
  EDITOR: 'share.role.editor',
  CO_OWNER: 'share.role.coOwner',
};

interface ShareNoteWithFriendProps {
  friendId: string;
  friendName: string;
  /** Notas que este amigo ja ve (nao aparecem outra vez na pesquisa). */
  alreadySharedIds: string[];
  onInvited: () => void;
}

// "Partilhar uma nota com a Ana" a partir da pagina do amigo: procura nas
// tuas notas, escolhe o papel e convida - sem ter de ir ao caderno.
export default function ShareNoteWithFriend({ friendId, friendName, alreadySharedIds, onInvited }: ShareNoteWithFriendProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NotebookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [role, setRole] = useState<ShareAccessRole>('EDITOR');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<{ text: string; entryId: string | null } | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen || !trimmed) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchNotebook(trimmed)
        .then((found) => {
          if (!cancelled) setResults(found.slice(0, MAX_RESULTS));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  const invite = async (entry: NotebookSearchResult) => {
    setBusyId(entry.id);
    setError(null);
    setMessage('');
    try {
      await inviteFriendToEntry(entry.id, friendId, role);
      setMessage(t('friend.share.sent', { title: entry.title, name: friendName }));
      notifySocialChanged();
      onInvited();
    } catch (caught) {
      // 409: link publico (os papeis so existem em Autorizado), nota cheia ou
      // recusou ha pouco. So o primeiro caso leva o link para o caderno.
      const conflictKey = INVITE_CONFLICT_KEY[getApiCode(caught) ?? ''];
      if (getHttpStatus(caught) !== HTTP_CONFLICT) {
        setError({ text: t('friend.share.error'), entryId: null });
      } else if (conflictKey) {
        setError({ text: t(conflictKey), entryId: null });
      } else {
        setError({ text: t('friend.share.publicLink'), entryId: entry.id });
      }
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
      >
        {t('friend.share.open', { name: friendName })}
      </button>
    );
  }

  const visible = results.filter((r) => !alreadySharedIds.includes(r.id));

  return (
    <div className="space-y-3 rounded-xl border border-violet-800/60 bg-violet-950/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{t('friend.share.open', { name: friendName })}</p>
        <button type="button" onClick={() => setIsOpen(false)} className="text-xs text-neutral-400 hover:text-white">
          {t('common.cancel')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('friend.share.search')}
          aria-label={t('friend.share.search')}
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ShareAccessRole)}
          aria-label={t('share.role.label')}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-2 text-sm text-neutral-200 focus:border-violet-500 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(ROLE_KEY[r])}
            </option>
          ))}
        </select>
      </div>
      {message && <p className="text-sm text-violet-300">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error.text}{' '}
          {error.entryId && (
            <Link to={notebookEntryPath(error.entryId, { share: true })} className="text-violet-400 underline">
              {t('friend.share.openInNotebook')}
            </Link>
          )}
        </p>
      )}
      {query.trim() && !isSearching && visible.length === 0 && (
        <p className="text-xs text-neutral-500">{t('friend.share.noResults')}</p>
      )}
      {visible.length > 0 && (
        <ul className="space-y-1.5">
          {visible.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-neutral-200">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: areaColorOf(entry.area.colorHex) }}
                />
                <span className="truncate">{entry.title}</span>
                <span className="hidden shrink-0 text-xs text-neutral-500 sm:inline">{entry.area.name}</span>
              </span>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void invite(entry)}
                className="shrink-0 rounded-md border border-violet-700 px-2.5 py-1 text-xs font-medium text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
              >
                {busyId === entry.id ? t('friend.share.sending') : t('friend.share.invite')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
