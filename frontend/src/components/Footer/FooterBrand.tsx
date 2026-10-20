import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GithubIcon, ArrowUpRightIcon, MailIcon } from '../UI/Icons';
import { REPO_URL, CONTACT_EMAIL } from '../../lib/constants';
import { LANGUAGES, type LanguageCode } from '../../i18n/languages';
import { useI18n } from '../../i18n/useI18n';

// Data da ultima novidade. O changelog (muito texto) vem a pedido, para nao
// pesar no bundle principal onde o footer vive.
function useLatestUpdateDate(): string | null {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('../../lib/changelog')
      .then(({ CHANGELOG }) => {
        if (!cancelled) setDate(CHANGELOG[0]?.date ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return date;
}

export default function FooterBrand() {
  const { t, lang, setLang } = useI18n();
  const latestDate = useLatestUpdateDate();
  return (
    <div className="max-w-sm">
      <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
        Productivity Maxing
      </span>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{t('footer.tagline')}</p>

      {latestDate && (
        <Link
          to="/changelog"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-violet-700 hover:text-white"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          {t('footer.updated', {
            date: new Date(`${latestDate}T00:00:00Z`).toLocaleDateString(lang, { timeZone: 'UTC' }),
          })}
        </Link>
      )}

      <div className="mt-4 flex flex-col items-start gap-2">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
        >
          <GithubIcon />
          <span>{t('footer.star')}</span>
          <ArrowUpRightIcon className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </a>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <MailIcon />
          <span>{CONTACT_EMAIL}</span>
        </a>
      </div>

      {/* Lingua tambem aqui: quem abre um link partilhado sem conta nao tem
          o Perfil para a mudar. */}
      <label className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        {t('footer.language')}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as LanguageCode)}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-violet-600 focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
