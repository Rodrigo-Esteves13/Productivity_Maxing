import { useId } from 'react';
import { SearchIcon, XIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Texto do placeholder e do rotulo acessivel (ja traduzido).
  label: string;
  className?: string;
}

// Campo de pesquisa partilhado das listas: lupa, botao de limpar, Esc limpa,
// alvo de toque >=44px em ecras de toque.
export default function SearchField({ value, onChange, label, className = '' }: SearchFieldProps) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className={`relative w-full sm:max-w-xs ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
          }
        }}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 pl-9 pr-10 text-base text-white placeholder:text-neutral-500 hover:border-neutral-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50 pointer-coarse:min-h-11 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('search.clear')}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-neutral-400 hover:text-white pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
