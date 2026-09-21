import type { NotebookTable } from '../../types/models';
import { TrashIcon, PlusIcon } from '../UI/Icons';

interface NotebookTableEditorProps {
  table: NotebookTable;
  readOnly?: boolean;
  onChange: (next: NotebookTable) => void;
  onDelete: () => void;
}

// Uma tabela real (<table> com <input> por célula), não texto Markdown
// escrito dentro do textarea principal - a versão anterior (inserir
// pipes no textContent) ficava ilegível fora de um renderizador
// Markdown, que o Notebook não tem. Guardada à parte, em
// NotebookEntry.tables (ver schema.prisma), não em textContent.
export default function NotebookTableEditor({ table, readOnly = false, onChange, onDelete }: NotebookTableEditorProps) {
  const colCount = table.rows[0]?.length ?? 0;

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = table.rows.map((row, r) =>
      r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
    );
    onChange({ ...table, rows: nextRows });
  };

  const addRow = () => {
    onChange({ ...table, rows: [...table.rows, Array.from({ length: colCount }, () => '')] });
  };

  const addColumn = () => {
    onChange({ ...table, rows: table.rows.map((row) => [...row, '']) });
  };

  const removeRow = (rowIndex: number) => {
    if (table.rows.length <= 1) return;
    onChange({ ...table, rows: table.rows.filter((_, r) => r !== rowIndex) });
  };

  const removeColumn = (colIndex: number) => {
    if (colCount <= 1) return;
    onChange({ ...table, rows: table.rows.map((row) => row.filter((_, c) => c !== colIndex)) });
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Table</span>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700"
            >
              <PlusIcon className="h-3 w-3" />
              Row
            </button>
            <button
              type="button"
              onClick={addColumn}
              className="flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700"
            >
              <PlusIcon className="h-3 w-3" />
              Column
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete table"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-neutral-800 p-0">
                    <input
                      value={cell}
                      readOnly={readOnly}
                      onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                      className="w-24 min-w-full bg-transparent px-2 py-1.5 text-neutral-100 focus:bg-neutral-800 focus:outline-none"
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="w-6 p-0 align-middle">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      aria-label="Remove row"
                      className="text-neutral-600 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!readOnly && (
              <tr>
                {Array.from({ length: colCount }, (_, colIndex) => (
                  <td key={colIndex} className="p-0 text-center">
                    <button
                      type="button"
                      onClick={() => removeColumn(colIndex)}
                      aria-label="Remove column"
                      className="text-[10px] text-neutral-600 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </td>
                ))}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
