import { useState } from 'react';
import { XIcon } from '../UI/Icons';

interface BlockListEditorProps {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  // Validação simples opcional (ex: para domínios, rejeitar espaços).
  normalize?: (raw: string) => string | null;
}

// Editor de lista tipo "tags" - usado tanto para a lista de processos como
// para a lista de domínios no formulário do agente. Mantém-se genérico de
// propósito, para não teres dois componentes quase iguais.
export default function BlockListEditor({
  label,
  placeholder,
  items,
  onChange,
  normalize,
}: BlockListEditorProps) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const raw = draft.trim();
    if (!raw) return;
    const value = normalize ? normalize(raw) : raw;
    if (!value || items.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...items, value]);
    setDraft('');
  };

  const handleRemove = (value: string) => {
    onChange(items.filter((i) => i !== value));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">{label}</label>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-600"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm font-medium text-neutral-200 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600 italic">Nothing added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-neutral-200"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="text-neutral-500 hover:text-red-400 transition-colors p-0.5"
                title={`Remove ${item}`}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
