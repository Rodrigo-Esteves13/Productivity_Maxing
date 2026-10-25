import { useState } from 'react';
import type { FormEvent } from 'react';
import type { GradeAggregation, GradeComponent, GradeComponentInput } from '../../types/models';
import Input from '../UI/Input';
import Button from '../UI/Button';
import SegmentedControl, { type SegmentedOption } from '../UI/SegmentedControl';
import { CheckIcon, XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';

interface GradeComponentFormProps {
  initial?: GradeComponent;
  onSubmit: (input: GradeComponentInput) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_BEST_OF = 10;

export default function GradeComponentForm({ initial, onSubmit, onCancel }: GradeComponentFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [weight, setWeight] = useState(initial ? String(initial.weightPercentage) : '');
  const [aggregation, setAggregation] = useState<GradeAggregation>(initial?.aggregation ?? 'AVERAGE');
  const [bestOf, setBestOf] = useState(String(initial?.bestOfCount ?? DEFAULT_BEST_OF));
  const [expected, setExpected] = useState(initial?.expectedEntries ? String(initial.expectedEntries) : '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const ruleOptions: SegmentedOption<GradeAggregation>[] = [
    { value: 'AVERAGE', label: t('grades.rule.average') },
    { value: 'BEST_OF', label: t('grades.rule.bestOf') },
    { value: 'DROP_LOWEST', label: t('grades.rule.dropLowest') },
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const weightValue = Number(weight);
    if (!name.trim()) return setError(t('grades.form.nameRequired'));
    if (!weight || !Number.isFinite(weightValue) || weightValue < 0 || weightValue > 100) {
      return setError(t('grades.form.weightInvalid'));
    }
    const bestOfValue = Number(bestOf);
    if (aggregation === 'BEST_OF' && (!Number.isInteger(bestOfValue) || bestOfValue < 1)) {
      return setError(t('grades.form.bestOfInvalid'));
    }

    setError('');
    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        weightPercentage: weightValue,
        aggregation,
        bestOfCount: aggregation === 'BEST_OF' ? bestOfValue : undefined,
        // null (nao undefined) para limpar ao editar: o JSON deita fora o undefined.
        expectedEntries: expected ? Number(expected) : null,
      });
    } catch (err) {
      setError(getApiMessage(err, t('grades.error.generic')));
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Input
          label={t('grades.form.name')}
          value={name}
          maxLength={80}
          placeholder={t('grades.form.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('grades.form.weight')}
          type="number"
          min={0}
          max={100}
          step="any"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm text-neutral-400">{t('grades.form.rule')}</span>
        <SegmentedControl size="sm" options={ruleOptions} value={aggregation} onChange={setAggregation} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {aggregation === 'BEST_OF' && (
          <Input
            label={t('grades.form.bestOfCount')}
            type="number"
            min={1}
            value={bestOf}
            onChange={(e) => setBestOf(e.target.value)}
          />
        )}
        <Input
          label={t('grades.form.expected')}
          type="number"
          min={1}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={onCancel}>
          <XIcon className="h-4 w-4" />
          {t('grades.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50">
          <CheckIcon className="h-4 w-4" />
          {t('grades.save')}
        </Button>
      </div>
    </form>
  );
}
