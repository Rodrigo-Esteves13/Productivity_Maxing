import type { AgentConfig, AgentTriggerMode, Difficulty, ProgressStatus } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import ToggleRow from '../UI/ToggleRow';

interface TriggerRulesFormProps {
  config: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
}

// Rotulos vem de enum.<VALOR> (useEnumLabel), na lingua atual.
const DIFFICULTY_OPTIONS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

// COMPLETED fica de fora de propósito - não faz sentido como threshold de
// atraso (o backend rejeita-o com 400 se tentares mandar isso).
const PROGRESS_OPTIONS: ProgressStatus[] = ['ON_TRACK', 'BEHIND', 'VERY_BEHIND'];

export default function TriggerRulesForm({ config, onChange }: TriggerRulesFormProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
          {t('ui.blockWhen')}
        </h3>
        <p className="text-sm text-neutral-500 mb-3">
          {t('ui.pickAsManyAsYou')}
        </p>

        <ToggleRow
          variant="card"
          checked={config.hasOverdueTasks}
          onChange={(v) => onChange({ hasOverdueTasks: v })}
          label={t('ui.aTaskIsPastIts')}
          description={t('ui.blocksUntilTheTaskIs')}
        />
        <ToggleRow
          variant="card"
          checked={config.hasOverdueCheckins}
          onChange={(v) => onChange({ hasOverdueCheckins: v })}
          label={t('ui.aTaskHasnTBeen')}
          description={t('ui.onlyCountsOverdueTasksYou')}
        />
        <ToggleRow
          variant="card"
          checked={config.anyTaskToday}
          onChange={(v) => onChange({ anyTaskToday: v })}
          label={t('ui.anythingIsDueToday')}
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
            {PROGRESS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
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
            {DIFFICULTY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
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
