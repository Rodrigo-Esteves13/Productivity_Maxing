import { useState } from 'react';
import { SNIPPET_SECTIONS, TABLE_PRESETS, buildMarkdownTable } from './notebookSnippets';
import { TableIcon, SigmaIcon, NetworkIcon, CodeIcon, CopyIcon, CheckIcon, XIcon } from '../UI/Icons';
import { COPY_FEEDBACK_MS } from '../../lib/constants';

type InsertMode = 'insert' | 'copy';

interface NotebookToolsPanelProps {
  onInsert: (text: string) => void;
  onAddTable: (rows: number, cols: number) => void;
  onClose: () => void;
}

const SECTION_ICONS: Record<string, typeof TableIcon> = {
  math: SigmaIcon,
  networking: NetworkIcon,
  programming: CodeIcon,
};

// Um único toggle global (Insert vs Copy) em vez de um por botão - o
// utilizador escolhe o modo uma vez e depois clica à vontade em vários
// símbolos seguidos sem ter de repetir a escolha a cada clique.
export default function NotebookToolsPanel({ onInsert, onAddTable, onClose }: NotebookToolsPanelProps) {
  const [mode, setMode] = useState<InsertMode>('insert');
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');

  const handleUse = async (key: string, value: string) => {
    if (mode === 'insert') {
      onInsert(value);
    } else {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Clipboard access can be denied by the browser; insertion mode
        // still works as a fallback, so this is silent on purpose.
        return;
      }
    }
    setFeedbackKey(key);
    setTimeout(() => setFeedbackKey((current) => (current === key ? null : current)), COPY_FEEDBACK_MS);
  };

  // Tables are a real editable <table> in the entry (NotebookTableEditor),
  // not text - "insert" mode adds a live table via onAddTable. "copy"
  // mode still hands over the Markdown-equivalent text (buildMarkdownTable),
  // useful for pasting into something outside the Notebook that does
  // render Markdown.
  const handleUseTable = async (key: string, rows: number, cols: number) => {
    if (mode === 'insert') {
      onAddTable(rows, cols);
      setFeedbackKey(key);
      setTimeout(() => setFeedbackKey((current) => (current === key ? null : current)), COPY_FEEDBACK_MS);
      return;
    }
    await handleUse(key, buildMarkdownTable(rows, cols));
  };

  const handleCustomTable = () => {
    const rows = Number(customRows);
    const cols = Number(customCols);
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1) return;
    handleUseTable('table-custom', rows, cols);
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-800 bg-neutral-900/60">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tools</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-neutral-800 bg-neutral-950 p-0.5">
            <button
              type="button"
              onClick={() => setMode('insert')}
              aria-pressed={mode === 'insert'}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === 'insert' ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setMode('copy')}
              aria-pressed={mode === 'copy'}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === 'copy' ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tools panel"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <TableIcon className="h-3.5 w-3.5" />
            Tables
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABLE_PRESETS.map((preset) => (
              <SnippetButton
                key={preset.label}
                label={preset.label}
                showCopied={feedbackKey === `table-${preset.label}`}
                mode={mode}
                onClick={() => handleUseTable(`table-${preset.label}`, preset.rows, preset.cols)}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={20}
              value={customRows}
              onChange={(e) => setCustomRows(e.target.value)}
              aria-label="Custom table rows"
              className="w-12 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
            />
            <span className="text-xs text-neutral-600">rows x</span>
            <input
              type="number"
              min={1}
              max={10}
              value={customCols}
              onChange={(e) => setCustomCols(e.target.value)}
              aria-label="Custom table columns"
              className="w-12 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
            />
            <span className="text-xs text-neutral-600">cols</span>
            <button
              type="button"
              onClick={handleCustomTable}
              className="ml-auto rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700"
            >
              {mode === 'insert' ? 'Insert' : 'Copy'}
            </button>
          </div>
        </section>

        {SNIPPET_SECTIONS.map((section) => {
          const SectionIcon = SECTION_ICONS[section.id] ?? SigmaIcon;
          return (
            <section key={section.id}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <SectionIcon className="h-3.5 w-3.5" />
                {section.title}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {section.items.map((item) => {
                  const key = `${section.id}-${item.label}`;
                  return (
                    <SnippetButton
                      key={key}
                      label={item.label}
                      title={item.description}
                      showCopied={feedbackKey === key}
                      mode={mode}
                      onClick={() => handleUse(key, item.value)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface SnippetButtonProps {
  label: string;
  title?: string;
  mode: InsertMode;
  showCopied: boolean;
  onClick: () => void;
}

function SnippetButton({ label, title, mode, showCopied, onClick }: SnippetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className="flex min-w-[2rem] items-center justify-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 transition-colors hover:border-violet-500 hover:text-white"
    >
      {showCopied && <CheckIcon className="h-3 w-3 text-emerald-400" />}
      {!showCopied && mode === 'copy' && <CopyIcon className="h-3 w-3 text-neutral-600" />}
      {label}
    </button>
  );
}
