import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import ErrorState from '../components/UI/ErrorState';
import PadEditor from '../components/Pad/PadEditor';
import useSeo from '../hooks/useSeo';
import { useI18n } from '../i18n/useI18n';
import { PADS_PATH, padPath } from '../lib/appLinks';
import { isValidPadSlug, toPadSlug } from '../lib/padSlug';
import { clearPadRecents, loadPadRecents } from '../lib/padRecents';

// Pads: a ideia do dontpad dentro da app. /pad escolhe um nome, /pad/<nome>
// abre o texto partilhado com esse nome.
export default function Pad() {
  const { t } = useI18n();
  const { slug: rawSlug } = useParams<{ slug?: string }>();
  const slug = rawSlug ? rawSlug.toLowerCase() : '';
  // Muda a key do editor para voltar a pedir o pad depois de um erro.
  const [attempt, setAttempt] = useState(0);
  // Publica, mas nunca indexada (o _headers do Netlify manda o mesmo noindex).
  useSeo({
    title: slug ? `${slug} - ${t('nav.pads')}` : t('nav.pads'),
    description: t('pad.description'),
    path: slug ? padPath(slug) : PADS_PATH,
    noindex: true,
  });

  return (
    <PageLayout>
      {slug ? (
        <>
          <Breadcrumbs items={[{ label: t('nav.pads'), to: PADS_PATH }, { label: slug }]} />
          <PageHeader title={slug} />
          {isValidPadSlug(slug) ? <PadEditor key={`${slug}:${attempt}`} slug={slug} onRetry={() => setAttempt((n) => n + 1)} /> : <ErrorState message={t('pad.invalidName')} />}
        </>
      ) : (
        <>
          <PageHeader title={t('nav.pads')} description={t('pad.description')} />
          <OpenPadForm />
        </>
      )}
    </PageLayout>
  );
}

function OpenPadForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [recents, setRecents] = useState<string[]>(loadPadRecents);
  const slug = toPadSlug(name);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValidPadSlug(slug)) navigate(padPath(slug));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
      <Input
        label={t('pad.nameLabel')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('pad.namePlaceholder')}
        autoFocus
      />
      {slug && (
        <p className="text-xs text-neutral-500">
          {window.location.origin}
          {padPath(slug)}
        </p>
      )}
      <Button type="submit" disabled={!isValidPadSlug(slug)}>
        {t('pad.open')}
      </Button>
      {recents.length > 0 && (
        <section aria-labelledby="pad-recents-title" className="pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="pad-recents-title" className="text-sm font-medium text-neutral-300">
              {t('ux4notes.pad.recents')}
            </h2>
            <button
              type="button"
              onClick={() => {
                clearPadRecents();
                setRecents([]);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300 pointer-coarse:min-h-11"
            >
              {t('ux4notes.pad.recentsClear')}
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recents.map((recent) => (
              <li key={recent} className="min-w-0 max-w-full">
                <Link
                  to={padPath(recent)}
                  title={recent}
                  className="block truncate rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-violet-300 hover:border-neutral-600 hover:text-violet-200 pointer-coarse:min-h-11 pointer-coarse:py-2.5"
                >
                  {recent}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
