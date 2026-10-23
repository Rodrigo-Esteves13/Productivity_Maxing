import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

// Pads: a ideia do dontpad dentro da app. /pad escolhe um nome, /pad/<nome>
// abre o texto partilhado com esse nome.
export default function Pad() {
  const { t } = useI18n();
  const { slug: rawSlug } = useParams<{ slug?: string }>();
  const slug = rawSlug ? rawSlug.toLowerCase() : '';
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
          {isValidPadSlug(slug) ? <PadEditor key={slug} slug={slug} /> : <ErrorState message={t('pad.invalidName')} />}
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
    </form>
  );
}
