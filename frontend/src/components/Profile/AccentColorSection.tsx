import { useAccentColor } from '../../hooks/useAccentColor';
import { ACCENT_IDS, ACCENT_SWATCHES, ACCENT_UNLOCK_COMPLETED, isAccentUnlocked } from '../../lib/accentColor';
import { useProfileStats } from '../../hooks/useProfileStats';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../context/useAuth';
import { CheckIcon, UndoIcon } from '../UI/Icons';

// Seletor da cor de destaque (Profile > Appearance). Guardado neste browser.
export default function AccentColorSection() {
  const { t } = useI18n();
  const { accent, setAccent, resetAccent, isDefault } = useAccentColor();
  const { completed } = useProfileStats();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium text-neutral-200">{t('accentColor.label')}</legend>
      <p className="mt-1 text-sm text-neutral-400">{t('accentColor.help')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ACCENT_IDS.map((id) => {
          const selected = accent === id;
          const unlocked = isAccentUnlocked(id, completed, isAdmin);
          const name = unlocked
            ? t(`accentColor.option.${id}`)
            : t('accentColor.locked', { name: t(`accentColor.option.${id}`), count: ACCENT_UNLOCK_COMPLETED[id] ?? 0 });
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAccent(id)}
              disabled={!unlocked}
              aria-pressed={selected}
              aria-label={name}
              title={name}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-white transition-colors ${
                selected ? 'border-white' : 'border-neutral-700 hover:border-neutral-400'
              } ${unlocked ? '' : 'opacity-30 cursor-not-allowed'}`}
              style={{ background: ACCENT_SWATCHES[id] }}
            >
              {selected && <CheckIcon className="h-4 w-4" aria-hidden="true" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={resetAccent}
          disabled={isDefault}
          className="ml-1 inline-flex items-center gap-1 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <UndoIcon className="h-4 w-4" aria-hidden="true" />
          {t('accentColor.reset')}
        </button>
      </div>
    </fieldset>
  );
}
