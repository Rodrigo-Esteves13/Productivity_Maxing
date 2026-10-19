import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { CHANGELOG } from '../lib/changelog';
import { useI18n } from '../i18n/useI18n';

export default function Changelog() {
  const { t } = useI18n();
  useDocumentTitle("What's new");
  return (
    <PageLayout>
      <PageHeader title={t('ui.whatSNew')} description={t('ui.recentChangesToProductivityMaxing')} />
      <div className="max-w-3xl space-y-6">
        {CHANGELOG.map((entry) => (
          <section
            key={entry.date}
            className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {new Date(`${entry.date}T00:00:00`).toLocaleDateString()}
            </p>
            <h2 className="text-lg font-semibold text-white mt-1">{entry.title}</h2>
            <ul className="mt-3 space-y-1.5 list-disc pl-5 text-sm text-neutral-300">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
