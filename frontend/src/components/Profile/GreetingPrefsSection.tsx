import { useId } from 'react';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { useGreetingPrefs } from '../../hooks/useGreetingPrefs';
import { GREETING_CUSTOM_MAX_LENGTH } from '../../lib/greeting';
import ToggleRow from '../UI/ToggleRow';

// Saudacao do Dashboard: texto proprio opcional e frase do dia ligada/desligada.
export default function GreetingPrefsSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { customGreeting, setCustomGreeting, showMotivation, setShowMotivation } = useGreetingPrefs(user?.id);
  const inputId = useId();

  return (
    <>
      <div className="mt-5">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-200">
          {t('greeting.pref.customLabel')}
        </label>
        <input
          id={inputId}
          type="text"
          value={customGreeting}
          maxLength={GREETING_CUSTOM_MAX_LENGTH}
          onChange={(e) => setCustomGreeting(e.target.value)}
          placeholder={t('greeting.pref.customPlaceholder')}
          className="mt-2 w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-violet-600"
        />
        <p className="mt-1 text-xs text-neutral-500">
          {t('greeting.pref.customHelp', { max: GREETING_CUSTOM_MAX_LENGTH })}
        </p>
      </div>
      <ToggleRow
        variant="inline"
        label={t('greeting.pref.motivationLabel')}
        description={t('greeting.pref.motivationHelp')}
        checked={showMotivation}
        onChange={setShowMotivation}
      />
    </>
  );
}
