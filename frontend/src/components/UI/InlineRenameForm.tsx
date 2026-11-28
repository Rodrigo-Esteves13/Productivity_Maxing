import { useState, type FormEvent } from 'react';
import Button from './Button';
import Input from './Input';
import { useEscapeLayer } from './modalStack';
import { useI18n } from '../../i18n/useI18n';

interface InlineRenameFormProps {
  initial: string;
  label: string;
  maxLength: number;
  // Rejeitar mantem o formulario aberto (o aviso de erro e de quem chama).
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

// Renomear na propria linha. Escape cancela sem fechar o modal por baixo.
export default function InlineRenameForm({ initial, label, maxLength, onSave, onCancel }: InlineRenameFormProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  useEscapeLayer(true, onCancel);
  const name = value.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!name || isSaving) return;
    if (name === initial) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(name);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="min-w-40 flex-1">
        <Input aria-label={label} value={value} maxLength={maxLength} onChange={(e) => setValue(e.target.value)} autoFocus />
      </div>
      <Button type="submit" size="sm" disabled={!name || isSaving}>
        {t('common.save')}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
    </form>
  );
}
