import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import IconButton from '../UI/IconButton';
import { PlusIcon, TrashIcon } from '../UI/Icons';
import NumberField from './NumberField';
import {
  CUSTOM_RULE_KINDS,
  CUSTOM_RULE_KIND_LABEL_KEY,
  CUSTOM_RULE_LABEL_MAX,
  CUSTOM_RULE_MAX_BELOW_LIMIT,
  CUSTOM_RULES_MAX,
  type CustomRuleDraft,
  type CustomRuleErrors,
  type CustomRuleKind,
} from '../../lib/approvalRules';
import { useI18n } from '../../i18n/useI18n';

interface CustomRulesFieldsetProps {
  idPrefix: string;
  rules: CustomRuleDraft[];
  errors: CustomRuleErrors[];
  onPatch: (key: string, changes: Partial<CustomRuleDraft>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}

// Regras extra escritas pelo utilizador.
export default function CustomRulesFieldset({
  idPrefix,
  rules,
  errors,
  onPatch,
  onAdd,
  onRemove,
}: CustomRulesFieldsetProps) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
      <legend className="px-1 text-xs uppercase tracking-wide text-neutral-500">
        {t('approvalRules.custom.title')}
      </legend>
      <p className="text-xs text-neutral-500">{t('approvalRules.custom.help')}</p>
      {rules.length === 0 && (
        <p className="text-xs text-neutral-500">{t('approvalRules.custom.empty')}</p>
      )}
      {rules.map((rule, index) => {
        const ruleErrors = errors[index] ?? {};
        const rowId = `${idPrefix}-${rule.key}`;
        return (
          <div key={rule.key} className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField label={t('approvalRules.custom.kind')} htmlFor={`${rowId}-kind`}>
                  <Select
                    id={`${rowId}-kind`}
                    value={rule.kind}
                    onChange={(e) => onPatch(rule.key, { kind: e.target.value as CustomRuleKind })}
                  >
                    {CUSTOM_RULE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(CUSTOM_RULE_KIND_LABEL_KEY[kind])}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <IconButton
                label={t('approvalRules.custom.remove')}
                onClick={() => onRemove(rule.key)}
                className="mb-1 text-neutral-500 hover:text-red-500"
              >
                <TrashIcon />
              </IconButton>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id={`${rowId}-threshold`}
                label={t('approvalRules.custom.threshold')}
                value={rule.threshold}
                error={ruleErrors.threshold}
                onChange={(value) => onPatch(rule.key, { threshold: value })}
              />
              {rule.kind === 'MAX_BELOW' && (
                <NumberField
                  id={`${rowId}-max-below`}
                  label={t('approvalRules.custom.maxBelow')}
                  value={rule.maxBelow}
                  error={ruleErrors.maxBelow}
                  errorParams={{ max: CUSTOM_RULE_MAX_BELOW_LIMIT }}
                  onChange={(value) => onPatch(rule.key, { maxBelow: value })}
                />
              )}
            </div>
            <FormField label={t('approvalRules.custom.labelContains')} htmlFor={`${rowId}-label`}>
              <Input
                id={`${rowId}-label`}
                type="text"
                value={rule.labelContains}
                maxLength={CUSTOM_RULE_LABEL_MAX}
                onChange={(e) => onPatch(rule.key, { labelContains: e.target.value })}
                aria-invalid={ruleErrors.label ? true : undefined}
                className={ruleErrors.label ? 'border-red-700' : ''}
              />
              <p className="mt-1 text-xs text-neutral-500">{t('approvalRules.custom.labelContains.help')}</p>
              {ruleErrors.label && <p className="mt-1 text-xs text-red-400">{t(ruleErrors.label, { max: CUSTOM_RULE_LABEL_MAX })}</p>}
            </FormField>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAdd}
          disabled={rules.length >= CUSTOM_RULES_MAX}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          {t('approvalRules.custom.add')}
        </Button>
        {rules.length >= CUSTOM_RULES_MAX && (
          <span className="text-xs text-neutral-500">
            {t('approvalRules.custom.limit', { count: CUSTOM_RULES_MAX })}
          </span>
        )}
      </div>
    </fieldset>
  );
}
