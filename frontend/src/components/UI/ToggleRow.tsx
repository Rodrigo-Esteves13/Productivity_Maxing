import { useId } from 'react';

// Checkbox + rotulo + texto de ajuda. Antes havia tres copias locais
// (PreferencesCard, AccessibilitySettingsCard, TriggerRulesForm); cada uma
// mantem o seu aspeto via `variant`.
export type ToggleRowVariant = 'list' | 'card' | 'inline';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  variant?: ToggleRowVariant;
}

const VARIANT_CLASSES: Record<
  ToggleRowVariant,
  { wrapper: string; label: string; checkbox: string; title: string; help: string; checkboxFirst: boolean }
> = {
  // Lista de preferencias: texto a esquerda, checkbox a direita, separadores.
  list: {
    wrapper: 'py-2.5 border-b border-neutral-800 last:border-b-0',
    label: 'flex items-start justify-between gap-4 cursor-pointer',
    checkbox: 'mt-1 h-4 w-4 accent-violet-500 shrink-0',
    title: 'block text-sm font-medium text-neutral-200',
    help: 'block text-xs text-neutral-500 mt-0.5',
    checkboxFirst: false,
  },
  // Cartao com borda (regras do agente).
  card: {
    wrapper: '',
    label:
      'flex items-start gap-3 p-3 rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors',
    checkbox:
      'mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-violet-600 focus:ring-offset-neutral-950',
    title: 'block text-sm font-medium text-white',
    help: 'block text-sm text-neutral-500',
    checkboxFirst: true,
  },
  // Checkbox junto ao rotulo, ajuda por baixo (acessibilidade).
  inline: {
    wrapper: 'mt-5',
    label: 'flex items-start gap-2 cursor-pointer select-none',
    checkbox: 'mt-0.5 accent-violet-500',
    title: 'block text-sm text-neutral-200',
    help: 'block mt-1 text-xs text-neutral-500',
    checkboxFirst: true,
  },
};

export default function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  variant = 'list',
}: ToggleRowProps) {
  const helpId = useId();
  const classes = VARIANT_CLASSES[variant];
  const checkbox = (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-describedby={helpId}
      onChange={(e) => onChange(e.target.checked)}
      className={classes.checkbox}
    />
  );
  return (
    <div className={classes.wrapper}>
      <label className={classes.label}>
        {classes.checkboxFirst && checkbox}
        <span className="min-w-0">
          <span className={classes.title}>{label}</span>
          <span id={helpId} className={classes.help}>
            {description}
          </span>
        </span>
        {!classes.checkboxFirst && checkbox}
      </label>
    </div>
  );
}
