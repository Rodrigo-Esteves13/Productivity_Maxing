import { useState } from 'react';
import type { RefObject } from 'react';
import type { NotebookTable } from '../../../types/models';
import { TableIcon, TypeIcon, PencilIcon } from '../../UI/Icons';
import ToggleChip from '../../UI/ToggleChip';
import { useI18n } from '../../../i18n/useI18n';
import NotebookToolsPanel from '../NotebookToolsPanel';
import NotebookTableEditor from '../NotebookTableEditor';
import CaseTransformBar from '../CaseTransformBar';
import EntrySectionHeader from './EntrySectionHeader';
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

// Notas em texto + ferramentas (tabelas/simbolos, maiusculas/minusculas) +
// tabelas da entrada. O texto lido e escrito na mesma serifa, para a folha
// parecer papel e nao um formulario.
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
  const { t } = useI18n();
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const [isCaseBarOpen, setIsCaseBarOpen] = useState(false);
  const isOverLimit = textContent.length > MAX_TEXT_CONTENT_LENGTH;

  return (
    <section>
      <EntrySectionHeader
        icon={PencilIcon}
        title={t('notebook.section.notes')}
        action={
          isEditing && (
            <div className="flex items-center gap-1.5">
              <ToggleChip size="sm" pressed={isCaseBarOpen} onClick={() => setIsCaseBarOpen((prev) => !prev)} className="flex items-center gap-1.5 text-xs">
                <TypeIcon className="h-3.5 w-3.5" />
                {t('notebook.case.button')}
              </ToggleChip>
              <ToggleChip size="sm" pressed={isToolsPanelOpen} onClick={() => setIsToolsPanelOpen((prev) => !prev)} className="flex items-center gap-1.5 text-xs">
                <TableIcon className="h-3.5 w-3.5" />
                {t('notebook.tools.tablesSymbols')}
              </ToggleChip>
            </div>
          )
        }
      />

      {isEditing && isCaseBarOpen && (
        <div className="mb-3">
          <CaseTransformBar textareaRef={textareaRef} textContent={textContent} onTextChange={onTextChange} />
        </div>
      )}

      {isEditing ? (
        <div className={`grid gap-3 ${isToolsPanelOpen ? 'md:grid-cols-[1fr_18rem]' : 'grid-cols-1'}`}>
          <div>
            <textarea
              ref={textareaRef}
              value={textContent}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={t('notebook.notes.placeholder')}
              rows={8}
              className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 font-serif text-base leading-7 text-neutral-100 placeholder-neutral-700 focus:border-violet-500 focus:outline-none"
            />
            <p className={`mt-1 text-right text-[11px] ${isOverLimit ? 'text-red-400' : 'text-neutral-600'}`}>
              {textContent.length.toLocaleString()} / {MAX_TEXT_CONTENT_LENGTH.toLocaleString()}
            </p>
          </div>

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
        <div className="max-w-prose whitespace-pre-wrap break-words font-serif text-base leading-7 text-neutral-200">
          {textContent || <span className="font-sans text-sm text-neutral-600">{t('notebook.notes.empty')}</span>}
        </div>
      )}

      {tables.length > 0 && (
        <div className="mt-4 space-y-3">
          {tables.map((table) => (
            <NotebookTableEditor
              key={table.id}
              table={table}
              readOnly={!isEditing}
              onChange={(next) => onTablesChange((prev) => prev.map((tb) => (tb.id === next.id ? next : tb)))}
              onDelete={() => onTablesChange((prev) => prev.filter((tb) => tb.id !== table.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
