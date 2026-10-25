import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import useSeo from '../hooks/useSeo';
import { REPO_URL, REPO_LICENSE_URL, CONTACT_EMAIL, APP_DOMAIN } from '../lib/constants';

const LAST_UPDATED = '24/10/2026';

export default function TermsOfService() {
  useSeo({
    title: 'Terms of Service',
    description:
      'The terms that govern using Productivity Maxing: acceptable use, your content, warranty, and liability.',
    path: '/terms',
    noindex: true, // legal boilerplate, not something worth ranking for
  });

  return (
    <PageLayout>
    <LegalPageLayout title="Terms of Service for Productivity Maxing" lastUpdated={LAST_UPDATED}>
      <LegalSection number={1} title="Acceptance of these terms">
        <p>
          By creating an account or otherwise using Productivity Maxing ("the App"), you agree to these
          Terms of Service. If you don't agree, please don't use the App.
        </p>
      </LegalSection>

      <LegalSection number={2} title="What the App is">
        <p>
          Productivity Maxing is a free, open-source personal productivity tool for tracking academic
          tasks, deadlines, and grades, with optional synchronization to Google Calendar and an optional
          Windows companion agent. It's developed and maintained by a single independent developer, me,
          Rodrigo Esteves, as a personal and academic project. The source code is public on{' '}
          <LegalLink href={REPO_URL}>GitHub</LegalLink>{' '}
          under the MIT License.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Eligibility">
        <p>You must be at least 13 years old to use the App. By using it, you confirm this is the case.</p>
      </LegalSection>

      <LegalSection number={4} title="Your account">
        <ul className="list-disc list-inside space-y-1">
          <li>You're responsible for keeping your login credentials and any API keys you generate confidential.</li>
          <li>You're responsible for all activity that happens under your account.</li>
          <li>
            If you believe your account or an API key has been compromised, please contact me immediately
            at <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> and revoke the
            affected credential from your account settings.
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={5} title="Acceptable use">
        <p className="mb-3">You agree not to:</p>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li>Use the App for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to any part of the App, its infrastructure, or other users' data</li>
          <li>Interfere with or disrupt the App's operation (e.g. excessive automated requests, attempts to bypass rate limits)</li>
          <li>Reverse-engineer the service beyond what the open-source license already permits on the published source code</li>
          <li>Use generated API keys for anything other than your own authorized access to your own data</li>
        </ul>
        <p>I reserve the right to suspend or terminate accounts that violate these terms.</p>
      </LegalSection>

      <LegalSection number={6} title="Your content">
        <p className="mb-3">
          You retain ownership of the task and grade data you create in the App ("Your Content"). You grant
          me only the limited right to store, process, and display Your Content back to you, and to sync it
          to Google Calendar (tasks you choose to sync, and your schedule once you confirm it) if you've connected it, solely for the purpose of operating the App for you.
        </p>
        <p>
          Study areas are different: they're a shared catalog that I curate and keep consistent for
          everyone, rather than content you create yourself. You choose which area each task belongs to,
          but the areas themselves aren't "Your Content" under this section.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Third-party sign-in and integrations">
        <p>
          The App lets you sign in via Google, GitHub, or Discord, and optionally sync with Google
          Calendar. Your use of those providers is subject to their own terms of service, in addition to
          these terms. I'm not responsible for the availability or behavior of third-party providers.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Open-source license">
        <p>
          The App's source code is distributed under the MIT License. These Terms of Service govern your
          use of the hosted, running application at {APP_DOMAIN}; they don't limit the rights already
          granted to you over the source code itself under the MIT License, which you can review in the{' '}
          <LegalLink href={REPO_LICENSE_URL}>
            LICENSE file
          </LegalLink>{' '}
          on GitHub.
        </p>
        <p className="mt-3">
          The downloadable Windows companion agent is covered separately by its own{' '}
          <LegalLink href="/eula">End User License Agreement</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection number={9} title="No warranty">
        <p>
          The App is provided "as is" and "as available," without warranties of any kind, express or
          implied, including but not limited to fitness for a particular purpose or uninterrupted
          availability. As a personal, independently-run project, I can't guarantee 24/7 uptime or commit
          to enterprise-grade support response times.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, I'm not liable for any indirect, incidental, or
          consequential damages arising from your use of, or inability to use, the App, including missed
          deadlines, data loss, or reliance on the App's calculations or reminders. You remain responsible
          for verifying your own academic deadlines and grades through your institution's official
          channels.
        </p>
        <p>
          <strong>Medication and health information.</strong> The Wellbeing medication feature is a
          reminder and a personal log only. It is not a medical device and it does not give medical
          advice, diagnosis, treatment or prevention of any condition. Its intended purpose is only a
          personal reminder and log for medication you already take as prescribed or as the leaflet
          says; it is not intended to diagnose, prevent, monitor, predict, treat or alleviate any disease,
          and it does not check doses, interactions or dependence. It is for your own personal use, not for managing
          medication for another person, and only for adults (18 or older, or the age of majority where
          you live). Before you can use it you must read and accept a separate medication notice in the
          App and confirm you are an adult; the version, language and date you accepted are stored in
          your account.
        </p>
        <p>
          The App never tells you whether a medicine, a dose or a combination is safe. Mixing medicines,
          or medicines with alcohol or other substances, can be dangerous, and some medicines can cause
          dependence even when taken as prescribed; the App does not check any of this. It does not know
          your health, your doses, your allergies or everything you take. Reminders may fail, arrive late
          or not show at all.
        </p>
        <p>
          Never start, stop, combine or change any medicine, or drink alcohol with it, because of
          something the App shows or does not show. Always follow your doctor or pharmacist and the
          leaflet. In an emergency, call your local emergency number (112 in the EU, 911 in the US).
        </p>
        <p>
          Nobody monitors what you log: the App does not alert any doctor, relative or emergency service,
          even when an entry looks dangerous. The emergency and support numbers shown in the App are
          provided only for convenience; they can change, be wrong or not apply where you are, and those
          services are run by third parties I do not control and am not responsible for. Always use your
          local emergency number when in doubt.
        </p>
        <p>
          You use the medication feature at your own risk and you remain solely responsible for your
          health decisions. To the maximum extent permitted by the law that applies to you, I'm not liable
          for any harm, adverse effect, health condition, injury or death related to medication, alcohol
          or any other substance, or to relying on (or not receiving) a reminder or any other information
          in the App. Nothing in these Terms limits liability that cannot be limited under the
          law that applies to you. If you do not agree, do not use the medication feature.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Termination">
        <p>
          You may stop using the App and delete your account at any time. I may suspend or terminate your
          access if you violate these terms, or discontinue the App entirely at my discretion, with
          reasonable notice where practical given the personal, non-commercial nature of the project.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Changes to these terms">
        <p>
          I may update these terms as the App evolves. Continued use of the App after changes are
          published constitutes acceptance of the updated terms. Material changes will be reflected by
          updating the "Last updated" date above.
        </p>
      </LegalSection>

      <LegalSection number={13} title="Governing law">
        <p>These terms are governed by the laws of Portugal, without regard to conflict-of-law principles.</p>
        <p>
          Nothing in these terms removes rights you have under mandatory consumer protection law where
          you live. If any part of these terms is found invalid or unenforceable, it is limited to the
          minimum extent necessary and the rest of these terms stays in full effect.
        </p>
      </LegalSection>

      <LegalSection number={14} title="Contact">
        <p>
          Questions about these terms: <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPageLayout>
    </PageLayout>
  );
}
