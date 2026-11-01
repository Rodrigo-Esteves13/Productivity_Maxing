import { useId, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { normalizeTag, TAGS_MAX, TAG_LEN_MAX } from '../../lib/taskTags';
import { XIcon } from './Icons';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

// Chip input: Enter or comma adds, Backspace on an empty draft removes the last.
export default function TagInput({ value, onChange, suggestions = [] }: TagInputProps) {
  const { t } = useI18n();
  const inputId = useId();
  const listId = useId();
  const [draft, setDraft] = useState('');

  // Aceita varias etiquetas de uma vez (colar "a,b,c"): cada parte vira chip.
  const add = (parts: string[]) => {
    const next = [...value];
    for (const part of parts) {
      const tag = normalizeTag(part);
      if (tag && !next.includes(tag) && next.length < TAGS_MAX) next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
  };

  const commit = () => {
    add([draft]);
    setDraft('');
  };

  const onDraftChange = (text: string) => {
    const parts = text.split(',');
    setDraft(parts.pop() ?? '');
    add(parts);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300 mb-1">
        {t('tags.label')}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-smooth-out focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-600/50">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-neutral-800 pl-2.5 text-xs text-neutral-200">
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== tag))}
              aria-label={t('tags.remove', { tag })}
              className="inline-flex h-10 w-8 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <XIcon aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          list={listId}
          value={draft}
          maxLength={TAG_LEN_MAX}
          disabled={value.length >= TAGS_MAX}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={value.length ? '' : t('tags.placeholder')}
          className="min-w-24 flex-1 bg-transparent px-1 py-2 text-base text-white placeholder:text-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </div>
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="mt-1 text-xs text-neutral-500 tabular-nums">{t('tags.hint', { n: value.length, max: TAGS_MAX })}</p>
    </div>
  );
}
