import { useEffect, useState } from 'react';
import { getScheduleLink, upsertScheduleLink, removeScheduleLink } from '../../api/notebookService';
import { CheckIcon, XIcon } from '../UI/Icons';

interface NotebookScheduleLinkProps {
  areaId: string;
}

// Widget pequeno, colapsável na prática (só aparece quando ainda não há
// ligação, ou quando o utilizador clica para editar) - a maioria das
// visitas ao caderno não precisa de tocar nisto, só na primeira vez por
// cadeira.
export default function NotebookScheduleLink({ areaId }: NotebookScheduleLinkProps) {
  const [linkedSubject, setLinkedSubject] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getScheduleLink(areaId)
      .then((link) => {
        if (cancelled) return;
        setLinkedSubject(link?.scheduleSubject ?? null);
        setDraft(link?.scheduleSubject ?? '');
      })
      .catch(() => {
        /* silencioso: isto é só a sugestão automática, nunca deve bloquear
           o resto do caderno se falhar */
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      await upsertScheduleLink(areaId, draft.trim());
      setLinkedSubject(draft.trim());
      setIsEditing(false);
    } catch {
      setError('That subject text is already linked to a different area.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    await removeScheduleLink(areaId);
    setLinkedSubject(null);
    setDraft('');
    setIsEditing(false);
  };

  if (!isEditing && linkedSubject) {
    return (
      <p className="text-xs text-neutral-500">
        Auto-detects classes tagged{' '}
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300">
          {linkedSubject}
        </span>{' '}
        in your schedule.{' '}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-violet-400 hover:underline"
        >
          Change
        </button>
      </p>
    );
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-xs text-violet-400 hover:underline"
      >
        Link this subject to your schedule for auto-detected class titles
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Subject text as it appears in your .ics (e.g. PC)"
        className="w-64 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="rounded-md p-1 text-emerald-400 hover:bg-neutral-800 disabled:opacity-50"
        aria-label="Save link"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>
      {linkedSubject && (
        <button
          type="button"
          onClick={handleRemove}
          className="rounded-md p-1 text-red-400 hover:bg-neutral-800"
          aria-label="Remove link"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
