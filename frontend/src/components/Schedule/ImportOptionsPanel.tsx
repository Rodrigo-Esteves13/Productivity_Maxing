import { DEFAULT_ICS_IMPORT_OPTIONS, type IcsImportOptions } from '../../utils/parseIcsSchedule';
import { useI18n } from '../../i18n/useI18n';

interface ImportOptionsPanelProps {
  options: IcsImportOptions;
  onChange: (next: IcsImportOptions) => void;
  disabled?: boolean;
}

const toList = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 30);

const inputCls =
  'w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white disabled:opacity-50';

// Ajustes para qualquer instituição: onde está o nome da disciplina, que
// palavras indicam o docente, e filtros por palavra-chave. Ficam guardados
// neste browser (ver useScheduleImport).
export default function ImportOptionsPanel({ options, onChange, disabled }: ImportOptionsPanelProps) {
  const { t } = useI18n();
  const set = (patch: Partial<IcsImportOptions>) => onChange({ ...options, ...patch });
  const segmentValue = options.subjectSegment === 'auto' || options.subjectSegment === 'whole'
    ? options.subjectSegment
    : String(options.subjectSegment);

  return (
    <details className="rounded-lg border border-neutral-800 p-3">
      <summary className="cursor-pointer text-sm text-neutral-300">{t('ui.importOptionsOtherSchoolsFormats')}</summary>
      <div className="mt-3 space-y-3">
        <label className="block text-xs text-neutral-400">
          Subject name comes from
          <select
            disabled={disabled}
            value={segmentValue}
            onChange={(e) => {
              const v = e.target.value;
              set({ subjectSegment: v === 'auto' || v === 'whole' ? v : Number(v) });
            }}
            className={`${inputCls} mt-1`}
          >
            <option value="auto">{t('ui.auto3rdPartIfThe')}</option>
            <option value="whole">{t('ui.wholeEventTitle')}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {t('ui.partOfTheTitle', { n: n })}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-neutral-400">
          Title separator
          <input
            disabled={disabled}
            value={options.subjectSeparator}
            maxLength={5}
            onChange={(e) => set({ subjectSeparator: e.target.value })}
            placeholder="|"
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block text-xs text-neutral-400">
          Words that introduce the teacher (comma separated)
          <input
            disabled={disabled}
            key={options.professorKeywords.join('|')}
            defaultValue={options.professorKeywords.join(', ')}
            onBlur={(e) => set({ professorKeywords: toList(e.target.value) })}
            placeholder={t('ui.teacherProfessor')}
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block text-xs text-neutral-400">
          Only import events containing (optional)
          <input
            disabled={disabled}
            key={options.includeKeywords.join('|')}
            defaultValue={options.includeKeywords.join(', ')}
            onBlur={(e) => set({ includeKeywords: toList(e.target.value) })}
            placeholder={t('ui.lectureLab')}
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block text-xs text-neutral-400">
          Skip events containing (optional)
          <input
            disabled={disabled}
            key={options.excludeKeywords.join('|')}
            defaultValue={options.excludeKeywords.join(', ')}
            onBlur={(e) => set({ excludeKeywords: toList(e.target.value) })}
            placeholder={t('ui.holidayExam')}
            className={`${inputCls} mt-1`}
          />
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(DEFAULT_ICS_IMPORT_OPTIONS)}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          {t('ui.resetToDefaults')}
        </button>
      </div>
    </details>
  );
}
