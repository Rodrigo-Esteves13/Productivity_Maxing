import type { AgentConfig, AgentTriggerMode, Difficulty, ProgressStatus } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface TriggerRulesFormProps {
  config: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
  { value: 'VERY_HARD', label: 'Very hard' },
];

// COMPLETED fica de fora de propósito - não faz sentido como threshold de
// atraso (o backend rejeita-o com 400 se tentares mandar isso).
const PROGRESS_OPTIONS: { value: ProgressStatus; label: string }[] = [
  { value: 'ON_TRACK', label: 'On track' },
  { value: 'BEHIND', label: 'Behind' },
  { value: 'VERY_BEHIND', label: 'Very behind' },
];

// Checkbox + rótulo + descrição, para as regras booleanas simples
// (hasOverdueTasks, hasOverdueCheckins, anyTaskToday).
function RuleToggle({
  checked,
  onToggle,
  title,
  description,
}: {
  checked: boolean;
  onToggle: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-violet-600 focus:ring-offset-neutral-950"
      />
      <span>
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="block text-sm text-neutral-500">{description}</span>
      </span>
    </label>
  );
}

export default function TriggerRulesForm({ config, onChange }: TriggerRulesFormProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
          {t('ui.blockWhen')}
        </h3>
        <p className="text-sm text-neutral-500 mb-3">
          {t('ui.pickAsManyAsYou')}
        </p>

        <RuleToggle
          checked={config.hasOverdueTasks}
          onToggle={(v) => onChange({ hasOverdueTasks: v })}
          title={t('ui.aTaskIsPastIts')}
          description={t('ui.blocksUntilTheTaskIs')}
        />
        <RuleToggle
          checked={config.hasOverdueCheckins}
          onToggle={(v) => onChange({ hasOverdueCheckins: v })}
          title={t('ui.aTaskHasnTBeen')}
          description={t('ui.onlyCountsOverdueTasksYou')}
        />
        <RuleToggle
          checked={config.anyTaskToday}
          onToggle={(v) => onChange({ anyTaskToday: v })}
          title={t('ui.anythingIsDueToday')}
          description={t('ui.theMostAggressiveOptionBlocks')}
        />

        <div className="p-3 rounded-lg border border-neutral-800 space-y-2">
          <span className="block text-sm font-medium text-white">{t('ui.progressStatusIsAtLeast')}</span>
          <span className="block text-sm text-neutral-500 mb-2">
            {t('ui.matchesTheBehindVeryBehind')}
          </span>
          <select
            value={config.minProgressStatus ?? ''}
            onChange={(e) =>
              onChange({ minProgressStatus: (e.target.value || null) as ProgressStatus | null })
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="">{t('ui.off')}</option>
            {PROGRESS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="p-3 rounded-lg border border-neutral-800 space-y-2">
          <span className="block text-sm font-medium text-white">
            {t('ui.todaySDifficultyIsAt')}
          </span>
          <span className="block text-sm text-neutral-500 mb-2">
            {t('ui.onlyLooksAtTasksDue')}
          </span>
          <select
            value={config.minDifficultyToday ?? ''}
            onChange={(e) =>
              onChange({ minDifficultyToday: (e.target.value || null) as Difficulty | null })
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="">{t('ui.off')}</option>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            {t('ui.triggerMode')}
          </label>
          <select
            value={config.triggerMode}
            onChange={(e) => onChange({ triggerMode: e.target.value as AgentTriggerMode })}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="ANY">{t('ui.anySelectedConditionRecommended')}</option>
            <option value="ALL">{t('ui.allSelectedConditionsAtOnce')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            {t('ui.ifTheAgentCanT')}
          </label>
          <select
            value={config.failMode}
            onChange={(e) => onChange({ failMode: e.target.value as AgentConfig['failMode'] })}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="CLOSED">{t('ui.keepLastKnownBlockingState')}</option>
            <option value="OPEN">{t('ui.unblockEverything')}</option>
          </select>
        </div>
      </div>

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          {t('ui.checkForUpdatesEverySeconds')}
        </label>
        <input
          type="number"
          min={15}
          max={3600}
          step={1}
          value={config.pollIntervalSeconds}
          onChange={(e) => onChange({ pollIntervalSeconds: Number(e.target.value) })}
          onBlur={(e) => {
            const parsed = Number(e.target.value);
            const clamped = Number.isFinite(parsed)
              ? Math.min(3600, Math.max(15, Math.round(parsed)))
              : 60;
            if (clamped !== parsed) onChange({ pollIntervalSeconds: clamped });
          }}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
        />
        <p className="text-xs text-neutral-500 mt-1">{t('ui.between15And3600Seconds')}</p>
      </div>
    </div>
  );
}
