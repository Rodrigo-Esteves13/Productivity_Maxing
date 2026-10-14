import { useState } from 'react';
import type { UsefulLink } from '../../../types/models';
import { LinkIcon, PlusIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import EntrySectionHeader from './EntrySectionHeader';
import EntryListRow from './EntryListRow';
import { SMALL_INPUT_CLASS, withProtocol } from './notebookEntryConfig';

const LABEL_MAX_LENGTH = 120;

interface UsefulLinksSectionProps {
  isEditing: boolean;
  links: UsefulLink[];
  onChange: (update: (prev: UsefulLink[]) => UsefulLink[]) => void;
}

export default function UsefulLinksSection({ isEditing, links, onChange }: UsefulLinksSectionProps) {
  const { t } = useI18n();
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    const rawUrl = newUrl.trim();
    if (!rawUrl) return;
    const label = newLabel.trim() || rawUrl;
    onChange((prev) => [...prev, { id: crypto.randomUUID(), label, url: withProtocol(rawUrl) }]);
    setNewLabel('');
    setNewUrl('');
  };

  return (
    <section>
      <EntrySectionHeader icon={LinkIcon} title={t('notebook.section.links')} />

      {links.length === 0 && !isEditing ? (
        <p className="text-xs text-neutral-600">{t('notebook.links.none')}</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <EntryListRow
              key={link.id}
              icon={<LinkIcon className="h-3.5 w-3.5" />}
              removeLabel={isEditing ? t('notebook.links.remove') : undefined}
              onRemove={isEditing ? () => onChange((prev) => prev.filter((l) => l.id !== link.id)) : undefined}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-violet-400 hover:underline"
                title={link.url}
              >
                {link.label || link.url}
              </a>
            </EntryListRow>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('notebook.links.label')}
            maxLength={LABEL_MAX_LENGTH}
            className={`w-full sm:w-36 ${SMALL_INPUT_CLASS}`}
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="https://..."
            className={`min-w-[10rem] flex-1 ${SMALL_INPUT_CLASS}`}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
          >
            <PlusIcon className="h-3 w-3" />
            {t('notebook.links.add')}
          </button>
        </div>
      )}
    </section>
  );
}
