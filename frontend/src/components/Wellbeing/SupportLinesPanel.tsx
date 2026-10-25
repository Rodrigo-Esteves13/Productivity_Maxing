import { useMemo, useState } from 'react';
import Select from '../UI/Select';
import { useI18n } from '../../i18n/useI18n';
import {
  guessSupportCountry,
  INTERNATIONAL_HELPLINES_URL,
  SUPPORT_COUNTRIES,
  SUPPORT_LINES,
  SUPPORT_LINES_REVIEWED_AT,
  telHref,
} from '../../lib/supportLines';

// Numeros de emergencia e de apoio do pais escolhido (por defeito, o da
// regiao do browser). Sempre com o diretorio internacional para outros paises.
export default function SupportLinesPanel() {
  const { t, lang } = useI18n();
  const [country, setCountry] = useState(() => guessSupportCountry(lang, navigator.languages ?? []));
  const countryName = useMemo(() => {
    const names = new Intl.DisplayNames([lang], { type: 'region' });
    return (code: string) => names.of(code) ?? code;
  }, [lang]);
  const sorted = useMemo(
    () => [...SUPPORT_COUNTRIES].sort((a, b) => countryName(a).localeCompare(countryName(b), lang)),
    [countryName, lang],
  );

  return (
    <div className="space-y-3 rounded-lg border border-violet-900/50 bg-violet-950/20 p-3">
      <p className="text-sm font-semibold text-violet-300">{t('wellbeing.meds.support.title')}</p>
      <p className="text-xs text-neutral-300">{t('wellbeing.meds.support.intro')}</p>
      <Select label={t('wellbeing.meds.support.country')} value={country} onChange={(e) => setCountry(e.target.value)}>
        {sorted.map((code) => (
          <option key={code} value={code}>
            {countryName(code)}
          </option>
        ))}
      </Select>
      <ul className="space-y-1.5">
        {SUPPORT_LINES[country].map((line) => (
          <li key={`${line.kind}:${line.number}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block text-xs text-neutral-500">{t(`wellbeing.meds.support.kind.${line.kind}`)}</span>
              <span className="block truncate text-neutral-100">{line.name}</span>
            </span>
            <a
              href={telHref(line.number)}
              className="shrink-0 font-mono font-semibold tabular-nums text-violet-300 hover:text-violet-200"
            >
              {line.number}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-400">
        {t('wellbeing.meds.support.other')}{' '}
        <a
          href={INTERNATIONAL_HELPLINES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300"
        >
          findahelpline.com
        </a>
      </p>
      <p className="text-xs text-neutral-500">{t('wellbeing.meds.support.note', { date: SUPPORT_LINES_REVIEWED_AT })}</p>
    </div>
  );
}
