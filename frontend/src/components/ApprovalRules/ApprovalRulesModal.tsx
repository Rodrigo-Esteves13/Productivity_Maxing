import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import ToggleRow from '../UI/ToggleRow';
import FormError from '../UI/FormError';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import {
  applyApprovalRulesToAllAreas,
  getApprovalPresets,
  getApprovalRules,
  resetApprovalRules,
  saveApprovalRules,
  type ApprovalRulesPreset,
} from '../../api/approvalRulesService';
import {
  ROUNDING_LABEL_KEY,
  ROUNDING_OPTIONS,
  rulesToDraft,
  validateApprovalRulesDraft,
  type ApprovalRounding,
  type ApprovalRulesDraft,
  type ApprovalRulesField,
  type ApprovalRulesScope,
} from '../../lib/approvalRules';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface ApprovalRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ApprovalRulesScope;
  // Id do programa ou da cadeira, conforme o scope.
  targetId: string;
  // Nome mostrado junto ao titulo (programa ou cadeira).
  targetName?: string;
}

const CUSTOM_PRESET = '';

interface NumberFieldProps {
  id: string;
  label: string;
  help?: string;
  value: string;
  error?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}

function NumberField({ id, label, help, value, error, onChange }: NumberFieldProps) {
  const { t } = useI18n();
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <FormField label={label} htmlFor={id}>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={error ? 'border-red-700' : ''}
      />
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs text-neutral-500">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-400">
          {t(error)}
        </p>
      )}
    </FormField>
  );
}

export default function ApprovalRulesModal({
  isOpen,
  onClose,
  scope,
  targetId,
  targetName,
}: ApprovalRulesModalProps) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const [draft, setDraft] = useState<ApprovalRulesDraft | null>(null);
  const [presets, setPresets] = useState<ApprovalRulesPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [rules, presetList] = await Promise.all([
        getApprovalRules(scope, targetId),
        getApprovalPresets().catch(() => [] as ApprovalRulesPreset[]),
      ]);
      setDraft(rulesToDraft(rules));
      setPresets(presetList);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [scope, targetId]);

  useEffect(() => {
    if (!isOpen) return;
    setShowErrors(false);
    setSaveFailed(false);
    void load();
  }, [isOpen, load]);

  const validation = useMemo(
    () => (draft ? validateApprovalRulesDraft(draft) : null),
    [draft],
  );
  const errors = showErrors && validation ? validation.errors : {};

  const patch = (changes: Partial<ApprovalRulesDraft>) =>
    setDraft((prev) => (prev ? { ...prev, ...changes, presetKey: changes.presetKey ?? null } : prev));

  // Editar qualquer valor deixa de ser o preset; escolher um preset preenche tudo.
  const setNumber = (field: ApprovalRulesField) => (value: string) =>
    patch({ [field]: value } as Partial<ApprovalRulesDraft>);

  const handlePresetChange = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    if (preset) setDraft(rulesToDraft({ ...preset.rules, presetKey: preset.key }));
    else patch({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validation) return;
    setShowErrors(true);
    if (!validation.isValid || !validation.rules) return;

    setIsBusy(true);
    setSaveFailed(false);
    try {
      const saved = await saveApprovalRules(scope, targetId, validation.rules);
      setDraft(rulesToDraft(saved));
      notify(t('approvalRules.saved'), 'success');
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyAll = async () => {
    if (!validation) return;
    setShowErrors(true);
    if (!validation.isValid || !validation.rules) return;
    const confirmed = await confirm({
      title: t('approvalRules.applyAll.confirmTitle'),
      message: t('approvalRules.applyAll.confirm'),
      confirmLabel: t('approvalRules.applyAll'),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const count = await applyApprovalRulesToAllAreas(validation.rules);
      notify(t('approvalRules.applyAll.done', { count }), 'success');
      onClose();
    } catch {
      notify(t('approvalRules.applyAll.error'), 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: t('approvalRules.reset.confirmTitle'),
      message: t(`approvalRules.reset.confirm.${scope}`),
      confirmLabel: t(`approvalRules.reset.${scope}`),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await resetApprovalRules(scope, targetId);
      notify(t('approvalRules.reset.done'), 'success');
      setShowErrors(false);
      await load();
    } catch {
      notify(t('approvalRules.reset.error'), 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const title = `${t(`approvalRules.title.${scope}`)}${targetName ? `: ${targetName}` : ''}`;
  const idPrefix = `approval-rules-${scope}`;
  const hasSecond = draft ? draft.secondThreshold.trim() !== '' : false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {isLoading && !draft && (
        <LinesSkeleton lines={5} />
      )}

      {loadFailed && (
        <div className="space-y-3">
          <ErrorState message={t('approvalRules.loadError')} />
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {t('approvalRules.retry')}
          </Button>
        </div>
      )}

      {draft && !loadFailed && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-neutral-400">{t(`approvalRules.intro.${scope}`)}</p>

          <FormField label={t('approvalRules.preset.label')} htmlFor={`${idPrefix}-preset`}>
            <Select
              id={`${idPrefix}-preset`}
              value={draft.presetKey ?? CUSTOM_PRESET}
              onChange={(e) => handlePresetChange(e.target.value)}
              disabled={presets.length === 0}
            >
              <option value={CUSTOM_PRESET}>{t('approvalRules.preset.custom')}</option>
              {presets.map((preset) => {
                const nameKey = `approvalRules.presetName.${preset.key}`;
                const name = t(nameKey);
                return (
                  <option key={preset.key} value={preset.key}>
                    {name === nameKey ? preset.key : name}
                  </option>
                );
              })}
            </Select>
            <p className="mt-1 text-xs text-neutral-500">
              {presets.length === 0
                ? t('approvalRules.preset.none')
                : t('approvalRules.preset.help')}
            </p>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id={`${idPrefix}-scale-min`}
              label={t('approvalRules.scaleMin')}
              value={draft.scaleMin}
              error={errors.scaleMin}
              onChange={setNumber('scaleMin')}
            />
            <NumberField
              id={`${idPrefix}-scale-max`}
              label={t('approvalRules.scaleMax')}
              value={draft.scaleMax}
              error={errors.scaleMax}
              onChange={setNumber('scaleMax')}
            />
          </div>

          <NumberField
            id={`${idPrefix}-pass-mark`}
            label={t('approvalRules.passMark')}
            help={t('approvalRules.passMark.help')}
            value={draft.passMark}
            error={errors.passMark}
            onChange={setNumber('passMark')}
          />

          <FormField label={t('approvalRules.rounding')} htmlFor={`${idPrefix}-rounding`}>
            <Select
              id={`${idPrefix}-rounding`}
              value={draft.rounding}
              onChange={(e) => patch({ rounding: e.target.value as ApprovalRounding })}
            >
              {ROUNDING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(ROUNDING_LABEL_KEY[option])}
                </option>
              ))}
            </Select>
          </FormField>

          <NumberField
            id={`${idPrefix}-component-min`}
            label={t('approvalRules.componentMinGrade')}
            help={t('approvalRules.componentMinGrade.help')}
            value={draft.componentMinGrade}
            error={errors.componentMinGrade}
            onChange={setNumber('componentMinGrade')}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id={`${idPrefix}-second`}
              label={t('approvalRules.secondThreshold')}
              value={draft.secondThreshold}
              error={errors.secondThreshold}
              onChange={setNumber('secondThreshold')}
            />
            <NumberField
              id={`${idPrefix}-max-below`}
              label={t('approvalRules.maxBelowSecondThreshold')}
              value={hasSecond ? draft.maxBelowSecondThreshold : ''}
              error={errors.maxBelowSecondThreshold}
              onChange={setNumber('maxBelowSecondThreshold')}
            />
          </div>
          <p className="-mt-2 text-xs text-neutral-500">
            {t('approvalRules.secondThreshold.help')} {t('approvalRules.maxBelowSecondThreshold.help')}
          </p>

          <fieldset className="rounded-lg border border-neutral-800 p-3">
            <legend className="px-1 text-xs uppercase tracking-wide text-neutral-500">
              {t('approvalRules.tracks.title')}
            </legend>
            <ToggleRow
              variant="list"
              label={t('approvalRules.hasExamTrack')}
              description={t('approvalRules.hasExamTrack.help')}
              checked={draft.hasExamTrack}
              onChange={(value) => patch({ hasExamTrack: value })}
            />
            <ToggleRow
              variant="list"
              label={t('approvalRules.hasResitTrack')}
              description={t('approvalRules.hasResitTrack.help')}
              checked={draft.hasResitTrack}
              onChange={(value) => patch({ hasResitTrack: value })}
            />
          </fieldset>

          {showErrors && validation && !validation.isValid && (
            <FormError message={t('approvalRules.fixErrors')} />
          )}
          {saveFailed && <FormError message={t('approvalRules.saveError')} />}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleReset} disabled={isBusy}>
              {t(`approvalRules.reset.${scope}`)}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleApplyAll} disabled={isBusy}>
                {t('approvalRules.applyAll')}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy ? t('common.saving') : t('approvalRules.save')}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
