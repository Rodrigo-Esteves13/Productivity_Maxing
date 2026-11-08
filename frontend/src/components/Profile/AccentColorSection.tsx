import { useAccentColor } from '../../hooks/useAccentColor';
import { ACCENT_IDS, ACCENT_SWATCHES } from '../../lib/accentColor';
import { useI18n } from '../../i18n/useI18n';
import { CheckIcon, UndoIcon } from '../UI/Icons';

// Seletor da cor de destaque (Profile > Appearance). Guardado neste browser.
export default function AccentColorSection() {
  const { t } = useI18n();
  const { accent, setAccent, resetAccent, isDefault } = useAccentColor();

  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium text-neutral-200">{t('accentColor.label')}</legend>
      <p className="mt-1 text-sm text-neutral-400">{t('accentColor.help')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ACCENT_IDS.map((id) => {
          const selected = accent === id;
          const name = t(`accentColor.option.${id}`);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAccent(id)}
              aria-pressed={selected}
              aria-label={name}
              title={name}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-white transition-colors ${
                selected ? 'border-white' : 'border-neutral-700 hover:border-neutral-400'
              }`}
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
