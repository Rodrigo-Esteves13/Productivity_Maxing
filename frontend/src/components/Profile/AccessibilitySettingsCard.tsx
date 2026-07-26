import { FONT_SCALE_LABELS, useAccessibilityPrefs, type FontScale } from '../../hooks/useAccessibilityPrefs';

const FONT_SCALES: FontScale[] = ['normal', 'large', 'larger'];

// Same card styling as GoogleCalendarCard/DeleteAccountSection, so the
// Profile page reads as one consistent set of settings sections.
export default function AccessibilitySettingsCard() {
  const { fontScale, setFontScale, highContrast, toggleHighContrast } = useAccessibilityPrefs();

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white">Accessibility</h2>
      <p className="mt-1 text-sm text-neutral-400">
        These preferences are saved on this device and apply across the whole app.
      </p>

      <div className="mt-5">
        <p className="text-sm font-medium text-neutral-200">Font size</p>
        <div className="mt-2 inline-flex rounded-lg border border-neutral-800 overflow-hidden">
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
              {FONT_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={highContrast}
            onChange={toggleHighContrast}
            className="accent-violet-500"
          />
          High contrast mode
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Switches the dark theme to pure black and white with a brighter accent color.
        </p>
      </div>
    </div>
  );
}
