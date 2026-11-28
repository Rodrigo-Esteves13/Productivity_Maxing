import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  applyApprovalRulesToAreas,
  getApprovalPresets,
  getApprovalRules,
  resetApprovalRules,
  saveApprovalRules,
  type ApprovalRulesPreset,
} from '../../api/approvalRulesService';
import {
  GENERIC_PRESET_KEY,
  rulesToDraft,
  validateApprovalRulesDraft,
  type ApprovalRulesDraft,
  type ApprovalRulesField,
  type ApprovalRulesScope,
  type CustomRuleDraft,
  type CustomRuleErrors,
} from '../../lib/approvalRules';
import { addCustomRule, applyPreset, patchCustomRule, patchDraft, removeCustomRule } from '../../lib/approvalRulesDraft';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface UseApprovalRulesModalOptions {
  isOpen: boolean;
  onClose: () => void;
  scope: ApprovalRulesScope;
  targetId: string;
  bulkAreaIds?: string[];
  onBulkApplied?: () => void;
}

// Carregamento, rascunho e gravacao das regras de aprovacao.
export function useApprovalRulesModal({
  isOpen,
  onClose,
  scope,
  targetId,
  bulkAreaIds,
  onBulkApplied,
}: UseApprovalRulesModalOptions) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const [draft, setDraft] = useState<ApprovalRulesDraft | null>(null);
  const [presets, setPresets] = useState<ApprovalRulesPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const isBulk = bulkAreaIds !== undefined;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      if (isBulk) {
        // Sem cadeira de origem: parte do preset generico (ou do primeiro).
        const presetList = await getApprovalPresets();
        const base = presetList.find((p) => p.key === GENERIC_PRESET_KEY) ?? presetList[0];
        if (!base) throw new Error('no presets');
        setDraft(rulesToDraft({ ...base.rules, presetKey: base.key }));
        setPresets(presetList);
        return;
      }
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
  }, [scope, targetId, isBulk]);

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
  const customErrors: CustomRuleErrors[] = showErrors && validation ? validation.customErrors : [];

  const update = (change: (current: ApprovalRulesDraft) => ApprovalRulesDraft) =>
    setDraft((prev) => (prev ? change(prev) : prev));

  const patch = (changes: Partial<ApprovalRulesDraft>) => update((current) => patchDraft(current, changes));

  const setNumber = (field: ApprovalRulesField) => (value: string) =>
    patch({ [field]: value } as Partial<ApprovalRulesDraft>);

  const handlePresetChange = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    if (preset) setDraft((prev) => applyPreset(prev, preset));
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
      title: isBulk
        ? t('areas.bulkRules.confirmTitle', { count: bulkAreaIds.length })
        : t('approvalRules.applyAll.confirmTitle'),
      message: isBulk
        ? t('areas.bulkRules.confirm', { count: bulkAreaIds.length })
        : t('approvalRules.applyAll.confirm'),
      confirmLabel: t(isBulk ? 'areas.select.setRules' : 'approvalRules.applyAll'),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const count = await applyApprovalRulesToAreas(validation.rules, bulkAreaIds);
      notify(
        isBulk ? t('areas.bulkRules.done', { count }) : t('approvalRules.applyAll.done', { count }),
        'success',
      );
      if (isBulk) onBulkApplied?.();
      onClose();
    } catch {
      notify(isBulk ? t('areas.bulkRules.error') : t('approvalRules.applyAll.error'), 'error');
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

  return {
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
    reload: () => void load(),
    patch,
    setNumber,
    handlePresetChange,
    patchCustom: (key: string, changes: Partial<CustomRuleDraft>) =>
      update((current) => patchCustomRule(current, key, changes)),
    addCustom: () => update(addCustomRule),
    removeCustom: (key: string) => update((current) => removeCustomRule(current, key)),
    handleSubmit,
    handleApplyAll,
    handleReset,
  };
}
