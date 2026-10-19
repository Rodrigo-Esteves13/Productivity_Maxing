import { Link } from 'react-router-dom';
import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAgentConfig } from '../hooks/useAgentConfig';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import FormSkeleton from '../components/UI/FormSkeleton';
import SetupInstructions from '../components/Agent/SetupInstructions';
import TriggerRulesForm from '../components/Agent/TriggerRulesForm';
import BlockListEditor from '../components/Agent/BlockListEditor';
import { COPY_FEEDBACK_MS } from '../lib/constants';
import { useI18n } from '../i18n/useI18n';

// Secção genérica com título + descrição, para não repetir o mesmo
// wrapper de cartão em cada bloco da página.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-neutral-800 rounded-xl p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
      {description && <p className="text-sm text-neutral-400 mb-4">{description}</p>}
      {children}
    </section>
  );
}

// Domínios não podem ter espaços/protocolo/path - fica mais robusto contra
// alguém colar "https://www.youtube.com/" em vez de "youtube.com".
function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/^www\./, '');
  value = value.split('/')[0];
  if (!value || value.includes(' ')) return null;
  return value;
}

export default function Agent() {
  const { t } = useI18n();
  useDocumentTitle('Agent');

  const { config, isLoading: configLoading, isSaving, saveError, updateDraft, save } =
    useAgentConfig();
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), COPY_FEEDBACK_MS);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.agent')}
        description={t('ui.setUpPmaxingAgentTo')}
      />

      <div className="space-y-6">
        <Section title={t('ui.1SetUpTheAgent')}>
          <SetupInstructions />
        </Section>

        <Section
          title={t('ui.2ApiKey')}
          description={t('ui.theAgentAuthenticatesWithA')}
        >
          <Link
            to="/developer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm font-semibold text-white transition-colors"
          >
            {t('ui.manageApiKeys2')}
          </Link>
        </Section>

        <Section
          title={t('ui.3BlockingRules')}
          description={t('ui.changesHereApplyOnThe')}
        >
          {configLoading || !config ? (
            <FormSkeleton sections={1} />
          ) : (
            <>
              {!config.isConfigured && (
                <p className="text-sm text-amber-400/80 mb-4">
                  {t('ui.youHavenTSavedA')}
                </p>
              )}

              <TriggerRulesForm config={config} onChange={updateDraft} />

              <div className="grid sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-neutral-800">
                <BlockListEditor
                  label={t('ui.blockedProcesses')}
                  placeholder={t('ui.eGSteamExe')}
                  items={config.blockedProcesses}
                  onChange={(items) => updateDraft({ blockedProcesses: items })}
                />
                <BlockListEditor
                  label={t('ui.blockedDomains')}
                  placeholder={t('ui.eGYoutubeCom')}
                  items={config.blockedDomains}
                  onChange={(items) => updateDraft({ blockedDomains: items })}
                  normalize={normalizeDomain}
                />
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-neutral-800">
                <ActionButton type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? t('common.saving') : t('ui.saveConfiguration')}
                </ActionButton>
                {justSaved && <span className="text-sm text-emerald-400">{t('ui.saved')}</span>}
                {saveError && <span className="text-sm text-red-400">{saveError}</span>}
              </div>
            </>
          )}
        </Section>
      </div>
    </PageLayout>
  );
}
