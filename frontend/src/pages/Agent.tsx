import { Link } from 'react-router-dom';
import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAgentConfig } from '../hooks/useAgentConfig';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import SetupInstructions from '../components/Agent/SetupInstructions';
import TriggerRulesForm from '../components/Agent/TriggerRulesForm';
import BlockListEditor from '../components/Agent/BlockListEditor';
import { COPY_FEEDBACK_MS } from '../lib/constants';

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
        title="Agent"
        description="Set up pmaxing-agent to block distracting apps and sites on your computer, based on your pending tasks."
      />

      <div className="space-y-6">
        <Section title="1. Set up the agent">
          <SetupInstructions />
        </Section>

        <Section
          title="2. API key"
          description="The agent authenticates with a personal API key, sent as the x-api-key header."
        >
          <Link
            to="/developer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm font-semibold text-white transition-colors"
          >
            Manage API keys →
          </Link>
        </Section>

        <Section
          title="3. Blocking rules"
          description="Changes here apply on the agent's next poll - no need to restart it."
        >
          {configLoading || !config ? (
            <LoadingState message="Loading configuration..." />
          ) : (
            <>
              {!config.isConfigured && (
                <p className="text-sm text-amber-400/80 mb-4">
                  You haven't saved a configuration yet - these are just sensible defaults. Adjust
                  and save below to activate the agent.
                </p>
              )}

              <TriggerRulesForm config={config} onChange={updateDraft} />

              <div className="grid sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-neutral-800">
                <BlockListEditor
                  label="Blocked processes"
                  placeholder="e.g. steam.exe"
                  items={config.blockedProcesses}
                  onChange={(items) => updateDraft({ blockedProcesses: items })}
                />
                <BlockListEditor
                  label="Blocked domains"
                  placeholder="e.g. youtube.com"
                  items={config.blockedDomains}
                  onChange={(items) => updateDraft({ blockedDomains: items })}
                  normalize={normalizeDomain}
                />
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-neutral-800">
                <ActionButton type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save configuration'}
                </ActionButton>
                {justSaved && <span className="text-sm text-emerald-400">Saved!</span>}
                {saveError && <span className="text-sm text-red-400">{saveError}</span>}
              </div>
            </>
          )}
        </Section>
      </div>
    </PageLayout>
  );
}
