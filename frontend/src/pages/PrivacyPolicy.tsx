import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import LegalTable from '../components/Legal/LegalTable';
import { REPO_URL } from '../lib/constants';

const CONTACT_EMAIL = 'support@pmaxing.pt';
const APP_DOMAIN = 'app.pmaxing.pt';
const LAST_UPDATED = '07/07/2026';

export default function PrivacyPolicy() {
  return (
    <PageLayout>
    <LegalPageLayout title="Privacy Policy for Productivity Maxing" lastUpdated={LAST_UPDATED}>
      <LegalSection number={1} title="Who I am">
        <p className="mb-3">
          Productivity Maxing ("the App") is an open-source, single-developer academic project built and
          maintained by me, Rodrigo Esteves. The source code is public on{' '}
          <LegalLink href={REPO_URL}>GitHub</LegalLink>{' '}
          under the MIT License.
        </p>
        <p className="mb-3">
          For any privacy question, you can reach me at:{' '}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
        <p>This policy applies to the web application hosted at {APP_DOMAIN} and its backend API.</p>
      </LegalSection>

      <LegalSection number={2} title="What data I collect">
        <h3 className="text-lg font-medium mt-4 mb-1">2.1 Account information</h3>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li>Email address</li>
          <li>Display name</li>
          <li>Avatar image (uploaded by you, or provided by an OAuth provider)</li>
          <li>Password hash, only if you register with email/password; I never store your password in plain text</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-1">2.2 Data from sign-in providers</h3>
        <p className="mb-3">
          If you choose to sign in with Google, GitHub, or Discord instead of a password, I receive and
          store:
        </p>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li>Your email address and name, as provided by that platform</li>
          <li>A unique account identifier from that platform, used only to recognize you on future logins</li>
          <li>
            An OAuth access token and, when provided, a refresh token, <strong>encrypted at rest</strong>, in
            the database, used solely to make authorized API calls on your behalf (see section 3)
          </li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-1">2.3 Application data</h3>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li>
            Tasks and their metadata (due dates, weight, difficulty, target/actual grades, completion
            status, and the study area you assign each task to)
          </li>
          <li>
            The catalog of study areas itself is not personal data you create; it's a shared list of
            subjects/categories that I curate, and that all users select from
          </li>
          <li>Usage data needed to compute your progress and streaks</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-1">2.4 Technical data</h3>
        <p>
          Session cookies (<code>HttpOnly</code>, used only to keep you signed in) and a CSRF protection
          cookie. I don't use tracking or advertising cookies, and I don't use analytics services that
          profile visitors.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Google Calendar data: specific disclosure">
        <p className="mb-3">
          If you connect your Google account and grant Calendar access, the App requests the scope{' '}
          <code>https://www.googleapis.com/auth/calendar</code>.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>What I access:</strong> I create, read, and update calendar events that correspond to
            tasks/deadlines you create inside the App, so your academic deadlines appear on your Google
            Calendar automatically.
          </li>
          <li>
            <strong>Why this scope is needed:</strong> a narrower read-only scope wouldn't let the App
            create or update events on your calendar when you create or edit a task, which is the core
            feature this permission enables.
          </li>
          <li>
            <strong>What I do with it:</strong> calendar data is used exclusively to keep your Google
            Calendar in sync with your tasks inside the App. I don't read, store, or process any calendar
            events that the App itself didn't create.
          </li>
          <li>
            <strong>What I don't do:</strong> sell, share, or disclose your Google user data to any third
            party; use it for advertising of any kind; or use it to train generative AI/ML models.
          </li>
          <li>
            <strong>Retention:</strong> the encrypted OAuth tokens tied to your Google account are kept only
            as long as your account is active, or until you disconnect Google from your account settings or
            delete your account (see section 6).
          </li>
          <li>
            <strong>Revoking access:</strong> you can revoke the App's access to your Google account at any
            time from{' '}
            <LegalLink href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</LegalLink>,
            independently of anything you do inside the App.
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={4} title="Legal basis for processing (GDPR)">
        <p>
          Since I operate from and offer this service in Portugal (EU), your data is processed under the
          following legal bases: <strong>contract necessity</strong>, to provide the core functionality you
          sign up for (task management, calendar sync); and <strong>consent</strong>, for connecting
          optional third-party providers (Google/GitHub/Discord) and for the Calendar scope specifically,
          which you grant explicitly on the provider's own consent screen.
        </p>
      </LegalSection>

      <LegalSection number={5} title="How I use your data">
        <p className="mb-3">Your data is used only to:</p>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li>Authenticate you and maintain your session</li>
          <li>Store and display your tasks, their areas, and your progress</li>
          <li>Sync your tasks to Google Calendar, if you've connected it</li>
          <li>Operate the optional Windows companion agent that reads your task status via the API</li>
        </ul>
        <p>I don't sell your data, run ads, or share it with data brokers.</p>
      </LegalSection>

      <LegalSection number={6} title="Your rights and how to exercise them">
        <p className="mb-3">You may, at any time:</p>
        <ul className="list-disc list-inside mb-3 space-y-1">
          <li><strong>Access</strong> the data I hold about you</li>
          <li><strong>Correct</strong> inaccurate data via your profile settings</li>
          <li>
            <strong>Delete</strong> your account and all associated data; contact{' '}
            <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>, or use the in-app
            deletion option if available
          </li>
          <li><strong>Export</strong> your data in a portable format, on request</li>
          <li>
            <strong>Withdraw consent</strong> for a connected provider by unlinking it in your account
            settings, or by revoking access directly at the provider (
            <LegalLink href="https://myaccount.google.com/permissions">Google</LegalLink>,{' '}
            <LegalLink href="https://github.com/settings/applications">GitHub</LegalLink>, or your Discord
            authorized-apps settings)
          </li>
        </ul>
        <p>
          If you are in the EU/EEA, you also have the right to lodge a complaint with your national data
          protection authority (in Portugal, the <LegalLink href="https://www.cnpd.pt">CNPD</LegalLink>).
        </p>
      </LegalSection>

      <LegalSection number={7} title="Data security">
        <ul className="list-disc list-inside space-y-1">
          <li>All traffic is served over HTTPS.</li>
          <li>Authentication uses HttpOnly, Secure cookies; your session token is never accessible to JavaScript.</li>
          <li>Passwords are never stored in plain text.</li>
          <li>OAuth access/refresh tokens are encrypted at rest (AES-256-GCM) before being stored in the database.</li>
          <li>Avatar uploads are validated server-side against their actual file content, not just their claimed type.</li>
        </ul>
      </LegalSection>

      <LegalSection number={8} title="Third-party sub-processors">
        <p className="mb-3">
          To operate the App, the following infrastructure providers process data on my behalf:
        </p>
        <LegalTable
          headers={['Provider', 'Purpose']}
          rows={[
            { label: 'Supabase', value: 'Database hosting (PostgreSQL) and authentication for email/password accounts' },
            { label: 'Render', value: 'Backend application hosting' },
            { label: 'Netlify', value: 'Frontend application hosting' },
            { label: 'Google, GitHub, Discord', value: 'Optional sign-in providers (only if you choose to use them)' },
          ]}
        />
        <p>Each provider processes data under their own privacy policy and security practices.</p>
      </LegalSection>

      <LegalSection number={9} title="Children's privacy">
        <p className="mb-3">
          Under Portuguese law (Lei n.º 58/2019, implementing Article 8 of the GDPR), minors aged 13 and
          older may lawfully consent to using online services on their own, without parental
          authorization. Because of this, I don't require parental consent for users aged 13–17, though I'd
          encourage them to read this policy together with a parent or guardian if anything is unclear.
        </p>
        <p>
          The App is not directed at, and must not be used by, children under 13. I don't knowingly collect
          data from children under this age. If I become aware that a child under 13 has created an
          account, I will delete that account and any associated data as soon as possible. If you are a
          parent or guardian and believe a child under 13 has provided personal data to the App, please
          contact me at <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> so I can act
          on it.
        </p>
      </LegalSection>

      <LegalSection number={10} title="International data transfers">
        <p>
          Some of the infrastructure providers I rely on may process data outside of your country of
          residence. Where this involves a transfer outside the EU/EEA, it relies on that provider's own
          compliance mechanisms (e.g. Standard Contractual Clauses).
        </p>
      </LegalSection>

      <LegalSection number={11} title="Changes to this policy">
        <p>
          I may update this policy as the App evolves (e.g. when new features or data are added). Material
          changes will be reflected by updating the "Last updated" date above.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Contact">
        <p>
          Questions, requests, or concerns about this policy:{' '}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPageLayout>
    </PageLayout>
  );
}