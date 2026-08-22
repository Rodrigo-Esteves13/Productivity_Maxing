import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import useSeo from '../hooks/useSeo';
import { REPO_URL, REPO_LICENSE_URL, CONTACT_EMAIL } from '../lib/constants';

const LAST_UPDATED = '20/08/2026';

// Scoped deliberately to the downloadable Windows companion agent
// (pmaxing-agent.exe), not the web app - the web app's usage terms already
// live in TermsOfService.tsx. A EULA makes sense for something a user
// installs and runs locally; it would just duplicate the ToS if it also
// tried to cover the hosted app.
export default function Eula() {
  useSeo({
    title: 'End User License Agreement',
    description:
      'License terms for the Productivity Maxing Windows companion agent (pmaxing-agent.exe).',
    path: '/eula',
    noindex: true,
  });

  return (
    <PageLayout>
    <LegalPageLayout title="End User License Agreement" lastUpdated={LAST_UPDATED}>
      <LegalSection number={1} title="Scope">
        <p>
          This End User License Agreement ("EULA") governs your download, installation, and use of the
          Productivity Maxing Windows companion agent ("the Agent"), the standalone executable available
          from the App's downloads. It does not cover the hosted web application itself, which is governed
          by the <LegalLink href="/terms">Terms of Service</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection number={2} title="License grant">
        <p>
          Subject to this EULA, I grant you a personal, non-exclusive, non-transferable, revocable license
          to install and run the Agent on devices you own or control, solely to connect to your own
          Productivity Maxing account via an API key you generate yourself.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Open source">
        <p>
          The Agent's source code is public on <LegalLink href={REPO_URL}>GitHub</LegalLink> under the MIT
          License. Where this EULA and the MIT License overlap, the MIT License governs your rights over
          the source code itself (see the{' '}
          <LegalLink href={REPO_LICENSE_URL}>LICENSE file</LegalLink>); this EULA governs your use of the
          distributed, pre-built <code>.exe</code>.
        </p>
      </LegalSection>

      <LegalSection number={4} title="What the Agent does">
        <ul className="list-disc list-inside space-y-1">
          <li>Authenticates to the API using an API key you generate and paste in yourself.</li>
          <li>Reads your task status from your account to display it locally on your machine.</li>
          <li>Does not collect, transmit, or store any data beyond what's needed for that read access.</li>
        </ul>
      </LegalSection>

      <LegalSection number={5} title="Restrictions">
        <p className="mb-3">You agree not to:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Redistribute, sell, or sublicense the Agent as your own product</li>
          <li>Use the Agent to access any account other than your own</li>
          <li>Use an API key for any purpose other than authorizing your own local instance of the Agent</li>
          <li>Attempt to disable, bypass, or interfere with the Agent's authentication against the API</li>
        </ul>
      </LegalSection>

      <LegalSection number={6} title="No warranty">
        <p>
          The Agent is provided "as is," without warranty of any kind, express or implied. As a personal,
          independently-run project, I can't guarantee it will be free of bugs or compatible with every
          Windows configuration.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, I'm not liable for any damages arising from your
          installation or use of the Agent, including but not limited to data loss or system issues on the
          device you install it on.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Termination">
        <p>
          This license ends automatically if you violate its terms, or you can end it yourself at any time
          by uninstalling the Agent and revoking its API key from your account settings.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Changes to this agreement">
        <p>
          I may update this EULA as the Agent evolves. Material changes will be reflected by updating the
          "Last updated" date above; continued use of the Agent after a change is published means you
          accept the update.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Governing law">
        <p>This EULA is governed by the laws of Portugal, without regard to conflict-of-law principles.</p>
      </LegalSection>

      <LegalSection number={11} title="Contact">
        <p>
          Questions about this EULA: <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPageLayout>
    </PageLayout>
  );
}
