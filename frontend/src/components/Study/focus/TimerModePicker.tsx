import { useState } from 'react';
import ToggleChip from '../../UI/ToggleChip';
import {
  MAX_BREAK_MINUTES,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
  TIMER_PRESETS,
  normalizePlan,
  type TimerPlan,
} from '../../../lib/focusTimer';
import { useI18n } from '../../../i18n/useI18n';

interface TimerModePickerProps {
  value: TimerPlan | null;
  onChange: (plan: TimerPlan | null) => void;
}

const sameAs = (a: TimerPlan | null, b: TimerPlan) =>
  a !== null && a.focusMinutes === b.focusMinutes && a.breakMinutes === b.breakMinutes;

// Escolha do modo: cronometro livre (conta para cima) ou bloco com fim
// (conta para baixo, com pausa a seguir).
export default function TimerModePicker({ value, onChange }: TimerModePickerProps) {
  const { t } = useI18n();
  const [isCustom, setIsCustom] = useState(false);
  const [focus, setFocus] = useState('45');
  const [rest, setRest] = useState('10');

  const applyCustom = (focusText: string, restText: string) => {
    onChange(normalizePlan(Number(focusText), Number(restText)));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('ui.timerMode')}>
        <ToggleChip
          pressed={value === null && !isCustom}
          onClick={() => {
            setIsCustom(false);
            onChange(null);
          }}
        >
          {t('ui.free')}
        </ToggleChip>
        {TIMER_PRESETS.map((preset) => (
          <ToggleChip
            key={preset.label}
            pressed={!isCustom && sameAs(value, preset.plan)}
            onClick={() => {
              setIsCustom(false);
              onChange(preset.plan);
            }}
          >
            {preset.label}
          </ToggleChip>
        ))}
        <ToggleChip
          pressed={isCustom}
          onClick={() => {
            setIsCustom(true);
            applyCustom(focus, rest);
          }}
        >
          {t('ui.custom')}
        </ToggleChip>
      </div>

      {isCustom && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <label className="flex items-center gap-1.5">
            {t('ui.focus')}
            <input
              type="number"
              min={MIN_FOCUS_MINUTES}
              max={MAX_FOCUS_MINUTES}
              value={focus}
              onChange={(e) => {
                setFocus(e.target.value);
                applyCustom(e.target.value, rest);
              }}
              className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 focus:border-violet-500 focus:outline-none"
            />
            {t('ui.minShort')}
          </label>
          <label className="flex items-center gap-1.5">
            {t('ui.break')}
            <input
              type="number"
              min={0}
              max={MAX_BREAK_MINUTES}
              value={rest}
              onChange={(e) => {
                setRest(e.target.value);
                applyCustom(focus, e.target.value);
              }}
              className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 focus:border-violet-500 focus:outline-none"
            />
            {t('ui.minShort')}
          </label>
          {value === null && (
            <span className="text-amber-400">
              {t('ui.focusMinBreakUpTo', { minFocusMinutes: MIN_FOCUS_MINUTES, maxFocusMinutes: MAX_FOCUS_MINUTES, maxBreakMinutes: MAX_BREAK_MINUTES })}</span>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[11px] text-neutral-500">
        {value === null
          ? t('ui.freeCountsUpUntilYou')
          : t('ui.countsDownThenBreak', { focus: value.focusMinutes, rest: value.breakMinutes })}
      </p>
    </div>
  );
}
