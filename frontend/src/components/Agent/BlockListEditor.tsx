import { useState, type ClipboardEvent } from 'react';
import { XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';
import { addToBlockList, hasListSeparator, type BlockListReject } from '../../lib/blockListParse';

interface BlockListEditorProps {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  // Validação simples opcional (ex: para domínios, rejeitar espaços).
  normalize?: (raw: string) => string | null;
}

const REJECT_KEY: Record<BlockListReject['reason'], string> = {
  invalid: 'ux4admin.blockList.invalid',
  duplicate: 'ux4admin.blockList.duplicate',
};

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
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [rejected, setRejected] = useState<BlockListReject[]>([]);

  // Aceita um valor ou varios (virgula / uma por linha). O que ficou de fora
  // (duplicado ou invalido) fica no campo e e explicado por baixo.
  const addFrom = (raw: string) => {
    if (!raw.trim()) return;
    const result = addToBlockList(items, raw, normalize);
    if (result.added.length > 0) onChange(result.next);
    setRejected(result.rejected);
    setDraft(result.rejected.length > 0 && result.added.length === 0 ? raw : '');
  };

  const handleAdd = () => addFrom(draft);

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!hasListSeparator(text)) return;
    e.preventDefault();
    addFrom(text);
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
          onChange={(e) => {
            setDraft(e.target.value);
            if (rejected.length > 0) setRejected([]);
          }}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={rejected.length > 0}
          className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-base sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-600 pointer-coarse:min-h-11"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm font-medium text-neutral-200 transition-colors disabled:opacity-40 pointer-coarse:min-h-11"
        >
          {t('ui.add')}
        </button>
      </div>

      {rejected.length > 0 && (
        <ul role="alert" className="mb-3 space-y-0.5 text-xs text-red-400">
          {rejected.map((r, index) => (
            <li key={`${r.reason}-${r.value}-${index}`}>{t(REJECT_KEY[r.reason], { item: r.value })}</li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">{t('ui.nothingAddedYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex max-w-full items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-neutral-200"
            >
              <span className="truncate" title={item}>
                {item}
              </span>
              <IconButton
                label={t('ui.removeItem', { item })}
                onClick={() => handleRemove(item)}
                className="-my-2 -mr-2 shrink-0 text-neutral-500 hover:text-red-400"
              >
                <XIcon className="w-3.5 h-3.5" />
              </IconButton>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
