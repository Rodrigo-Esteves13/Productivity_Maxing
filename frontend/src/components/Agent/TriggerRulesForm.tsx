import type { AgentConfig, AgentTriggerMode, Difficulty, ProgressStatus } from '../../types/models';

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
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
          Block when...
        </h3>
        <p className="text-sm text-neutral-500 mb-3">
          Pick as many as you want. Use the mode below to decide if one is enough, or if all
          selected conditions need to be true at once.
        </p>

        <RuleToggle
          checked={config.hasOverdueTasks}
          onToggle={(v) => onChange({ hasOverdueTasks: v })}
          title="A task is past its deadline"
          description="Blocks until the task is actually marked complete - independent of whether you already answered today's overdue check-in popup."
        />
        <RuleToggle
          checked={config.hasOverdueCheckins}
          onToggle={(v) => onChange({ hasOverdueCheckins: v })}
          title="A task hasn't been checked in today"
          description="Only counts overdue tasks you haven't responded to in today's check-in popup yet - resets once a day, even if the task itself is still not done."
        />
        <RuleToggle
          checked={config.anyTaskToday}
          onToggle={(v) => onChange({ anyTaskToday: v })}
          title="Anything is due today"
          description="The most aggressive option - blocks all day as soon as there's something pending today, regardless of difficulty or status."
        />

        <div className="p-3 rounded-lg border border-neutral-800 space-y-2">
          <span className="block text-sm font-medium text-white">Progress status is at least</span>
          <span className="block text-sm text-neutral-500 mb-2">
            Matches the "Behind" / "Very behind" badges you see on the dashboard.
          </span>
          <select
            value={config.minProgressStatus ?? ''}
            onChange={(e) =>
              onChange({ minProgressStatus: (e.target.value || null) as ProgressStatus | null })
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="">Off</option>
            {PROGRESS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="p-3 rounded-lg border border-neutral-800 space-y-2">
          <span className="block text-sm font-medium text-white">
            Today's difficulty is at least
          </span>
          <span className="block text-sm text-neutral-500 mb-2">
            Only looks at tasks due today.
          </span>
          <select
            value={config.minDifficultyToday ?? ''}
            onChange={(e) =>
              onChange({ minDifficultyToday: (e.target.value || null) as Difficulty | null })
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="">Off</option>
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
            Trigger mode
          </label>
          <select
            value={config.triggerMode}
            onChange={(e) => onChange({ triggerMode: e.target.value as AgentTriggerMode })}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="ANY">Any selected condition (recommended)</option>
            <option value="ALL">All selected conditions at once</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            If the agent can't reach the app
          </label>
          <select
            value={config.failMode}
            onChange={(e) => onChange({ failMode: e.target.value as AgentConfig['failMode'] })}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="CLOSED">Keep last known blocking state (recommended)</option>
            <option value="OPEN">Unblock everything</option>
          </select>
        </div>
      </div>

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Check for updates every (seconds)
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
        <p className="text-xs text-neutral-500 mt-1">Between 15 and 3600 seconds.</p>
      </div>
    </div>
  );
}
