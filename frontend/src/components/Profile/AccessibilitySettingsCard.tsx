import { useAccessibilityPrefs, THEME_OPTIONS, type FontScale, type ThemeId } from '../../hooks/useAccessibilityPrefs';
import { LANGUAGES, type LanguageCode } from '../../i18n/languages';
import { useI18n } from '../../i18n/useI18n';

const FONT_SCALES: FontScale[] = ['normal', 'large', 'larger', 'largest'];

interface ToggleProps {
  label: string;
  help: string;
  checked: boolean;
  onChange: () => void;
}

function Toggle({ label, help, checked, onChange }: ToggleProps) {
  return (
    <div className="mt-5">
      <label className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={onChange} className="accent-violet-500" />
        {label}
      </label>
      <p className="mt-1 text-xs text-neutral-500">{help}</p>
    </div>
  );
}

// Aparencia e acessibilidade (tema, idioma, texto, contraste, daltonismo,
// movimento). Tudo guardado neste dispositivo; mesmo estilo dos outros cartoes
// do Profile.
export default function AccessibilitySettingsCard() {
  const {
    fontScale,
    setFontScale,
    highContrast,
    toggleHighContrast,
    theme,
    setTheme,
    colorblind,
    toggleColorblind,
    reduceMotion,
    toggleReduceMotion,
  } = useAccessibilityPrefs();
  const { t, lang, setLang } = useI18n();

  const themeChoices: { id: ThemeId; preview?: (typeof THEME_OPTIONS)[number]['preview'] }[] = [
    { id: 'system' },
    ...THEME_OPTIONS,
  ];

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white">{t('prefs.appearanceTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t('prefs.appearanceHelp')}</p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-neutral-200">{t('prefs.theme')}</legend>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {themeChoices.map((choice) => {
            const selected = theme === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setTheme(choice.id)}
                aria-pressed={selected}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? 'border-violet-500 text-white bg-violet-500/10'
                    : 'border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 rounded-full border border-neutral-600 overflow-hidden flex"
                  style={
                    choice.preview
                      ? { background: choice.preview.bg }
                      : { background: 'linear-gradient(90deg, #0d0920 50%, #f6f5fb 50%)' }
                  }
                >
                  {choice.preview && (
                    <span className="m-auto h-3 w-3 rounded-full" style={{ background: choice.preview.accent }} />
                  )}
                </span>
                {t(`prefs.theme.${choice.id}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="language-select" className="text-sm font-medium text-neutral-200">
          {t('prefs.language')}
        </label>
        <div className="mt-2">
          <select
            id="language-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as LanguageCode)}
            className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-violet-600"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-neutral-200">{t('prefs.fontSize')}</p>
        <div className="mt-2 inline-flex flex-wrap rounded-lg border border-neutral-800 overflow-hidden">
          {FONT_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              onClick={() => setFontScale(scale)}
              aria-pressed={fontScale === scale}
              className={`px-4 py-2 text-sm transition-colors ${
                fontScale === scale
                  ? 'bg-violet-600 text-white'
                  : 'bg-transparent text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {t(`prefs.font.${scale}`)}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label={t('prefs.highContrast')}
        help={t('prefs.highContrastHelp')}
        checked={highContrast}
        onChange={toggleHighContrast}
      />
      <Toggle
        label={t('prefs.colorblind')}
        help={t('prefs.colorblindHelp')}
        checked={colorblind}
        onChange={toggleColorblind}
      />
      <Toggle
        label={t('prefs.reduceMotion')}
        help={t('prefs.reduceMotionHelp')}
        checked={reduceMotion}
        onChange={toggleReduceMotion}
      />
    </div>
  );
}
