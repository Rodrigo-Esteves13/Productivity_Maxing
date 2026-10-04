import { useState } from 'react';
import type { RefObject } from 'react';
import type { NotebookTable } from '../../../types/models';
import { TableIcon } from '../../UI/Icons';
import SectionLabel from '../../UI/SectionLabel';
import NotebookToolsPanel from '../NotebookToolsPanel';
import NotebookTableEditor from '../NotebookTableEditor';
import { MAX_TEXT_CONTENT_LENGTH } from './notebookEntryConfig';

interface EntryNotesSectionProps {
  isEditing: boolean;
  textContent: string;
  onTextChange: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInsert: (snippet: string) => void;
  tables: NotebookTable[];
  onTablesChange: (update: (prev: NotebookTable[]) => NotebookTable[]) => void;
  onAddTable: (rows: number, cols: number) => void;
}

// Notas em texto + painel de tabelas/simbolos + tabelas da entrada.
export default function EntryNotesSection({
  isEditing,
  textContent,
  onTextChange,
  textareaRef,
  onInsert,
  tables,
  onTablesChange,
  onAddTable,
}: EntryNotesSectionProps) {
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const isOverLimit = textContent.length > MAX_TEXT_CONTENT_LENGTH;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <SectionLabel>Notes</SectionLabel>
        {isEditing && (
          <button
            type="button"
            onClick={() => setIsToolsPanelOpen((prev) => !prev)}
            aria-pressed={isToolsPanelOpen}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              isToolsPanelOpen ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tables &amp; Symbols
          </button>
        )}
      </div>

      {isEditing ? (
        <div className={`grid gap-3 ${isToolsPanelOpen ? 'md:grid-cols-[1fr_18rem]' : 'grid-cols-1'}`}>
          <textarea
            ref={textareaRef}
            value={textContent}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Write your notes here..."
            rows={5}
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
          />
          <p className={`-mt-1 text-right text-[11px] ${isOverLimit ? 'text-red-400' : 'text-neutral-600'}`}>
            {textContent.length.toLocaleString()} / {MAX_TEXT_CONTENT_LENGTH.toLocaleString()}
          </p>

          {isToolsPanelOpen && (
            <div className="h-64 md:h-auto">
              <NotebookToolsPanel
                onInsert={onInsert}
                onAddTable={onAddTable}
                onClose={() => setIsToolsPanelOpen(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200">
          {textContent || <span className="text-neutral-600">No notes.</span>}
        </div>
      )}

      {tables.length > 0 && (
        <div className="mt-3 space-y-3">
          {tables.map((table) => (
            <NotebookTableEditor
              key={table.id}
              table={table}
              readOnly={!isEditing}
              onChange={(next) => onTablesChange((prev) => prev.map((t) => (t.id === next.id ? next : t)))}
              onDelete={() => onTablesChange((prev) => prev.filter((t) => t.id !== table.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
