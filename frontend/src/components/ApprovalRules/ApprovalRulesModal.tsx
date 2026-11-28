import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Select from '../UI/Select';
import Button from '../UI/Button';
import ToggleRow from '../UI/ToggleRow';
import FormError from '../UI/FormError';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import NumberField from './NumberField';
import CustomRulesFieldset from './CustomRulesFieldset';
import ApprovalRulesActions from './ApprovalRulesActions';
import { useApprovalRulesModal } from './useApprovalRulesModal';
import {
  ROUNDING_LABEL_KEY,
  ROUNDING_OPTIONS,
  type ApprovalRounding,
  type ApprovalRulesScope,
} from '../../lib/approvalRules';
import { useI18n } from '../../i18n/useI18n';

interface ApprovalRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ApprovalRulesScope;
  // Id do programa ou da cadeira, conforme o scope.
  targetId: string;
  // Nome mostrado junto ao titulo (programa ou cadeira).
  targetName?: string;
  // Modo em massa (scope 'area'): grava as regras so nestas cadeiras e nao
  // carrega as regras de uma cadeira (targetId ignorado).
  bulkAreaIds?: string[];
  onBulkApplied?: () => void;
}

const CUSTOM_PRESET = '';

export default function ApprovalRulesModal({
  isOpen,
  onClose,
  scope,
  targetId,
  targetName,
  bulkAreaIds,
  onBulkApplied,
}: ApprovalRulesModalProps) {
  const { t } = useI18n();
  const {
    draft,
    presets,
    isBulk,
    isLoading,
    loadFailed,
    isBusy,
    saveFailed,
    showErrors,
    validation,
    errors,
    customErrors,
    reload,
    patch,
    setNumber,
    handlePresetChange,
    patchCustom,
    addCustom,
    removeCustom,
    handleSubmit,
    handleApplyAll,
    handleReset,
  } = useApprovalRulesModal({ isOpen, onClose, scope, targetId, bulkAreaIds, onBulkApplied });

  const title = isBulk
    ? t('areas.select.setRules')
    : `${t(`approvalRules.title.${scope}`)}${targetName ? `: ${targetName}` : ''}`;
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
          <Button type="button" variant="secondary" onClick={reload}>
            {t('approvalRules.retry')}
          </Button>
        </div>
      )}

      {draft && !loadFailed && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-neutral-400">
            {isBulk ? t('approvalRules.applyAll.scope.selected') : t(`approvalRules.intro.${scope}`)}
          </p>

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

          <CustomRulesFieldset
            idPrefix={idPrefix}
            rules={draft.customRules}
            errors={customErrors}
            onPatch={patchCustom}
            onAdd={addCustom}
            onRemove={removeCustom}
          />

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

          <ApprovalRulesActions
            scope={scope}
            isBulk={isBulk}
            isBusy={isBusy}
            onReset={handleReset}
            onApplyAll={handleApplyAll}
            onClose={onClose}
          />
        </form>
      )}
    </Modal>
  );
}
