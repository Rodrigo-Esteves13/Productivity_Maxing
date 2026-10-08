import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import LegalTable from '../components/Legal/LegalTable';
import useSeo from '../hooks/useSeo';
import { REPO_URL, CONTACT_EMAIL, APP_DOMAIN } from '../lib/constants';

const LAST_UPDATED = '08/10/2026';

export default function PrivacyPolicy() {
  useSeo({
    title: 'Privacy Policy',
    description:
      'How Productivity Maxing collects, uses, and protects your account, task, and Google Calendar sync data.',
    path: '/privacy',
    noindex: true, // legal boilerplate, not something worth ranking for
  });

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
          <li>
            If you connect Google Calendar: a record of each event the App created for you (Google's
            event ID, the event title, and its date and time), so the App can later update or remove
            exactly those events and nothing else
          </li>
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
          Signing in with Google only requests your basic profile (email and name). Calendar access is
          a separate, optional step. If you choose to connect Google Calendar, the App requests this
          one additional scope:{' '}
          <code>https://www.googleapis.com/auth/calendar.events</code> ("See and edit events on all
          your calendars").
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>What I do with it:</strong> I only <em>create</em>, <em>update</em>, and{' '}
            <em>delete</em> events that the App itself created in your primary calendar. I never read,
            list, or modify any other event in your calendar. The events I create come from:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <strong>Tasks you choose to sync</strong> (button on a task): title, due date and time,
                and a description with the task's area, type, difficulty, status, topics, weight,
                target and real grade, and reference link, if you filled them in.
              </li>
              <li>
                <strong>Your schedule, after you confirm a preview</strong> (Schedule page): your classes
                (subject, room, professor), your work shifts, travel-time blocks, and suggested study
                blocks from your study plan. Nothing is written until you confirm.
              </li>
            </ul>
          </li>
          <li>
            <strong>Why this scope is needed:</strong> creating, updating, and removing events requires
            write access to events. A read-only scope can't do that. I don't request the broader{' '}
            <code>calendar</code> scope, which would also allow managing or deleting whole calendars,
            because the App doesn't need it.
          </li>
          <li>
            <strong>Limited Use:</strong> the App's use and transfer of information received from
            Google APIs to any other app adheres to the{' '}
            <LegalLink href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </LegalLink>
            , including the Limited Use requirements. Google user data is used only to provide the
            Calendar sync features described above.
          </li>
          <li>
            <strong>What I don't do:</strong> sell, share, or disclose your Google user data to any
            third party (other than the infrastructure providers in section 8, which process it only to
            run the App); use it for advertising of any kind, including retargeting or personalized ads;
            use it to develop, improve, or train generative AI or machine-learning models; or let
            humans read it, except with your explicit consent (for example, when you send me a support
            request), where necessary for security or to comply with the law.
          </li>
          <li>
            <strong>Retention and deletion:</strong> when you disconnect Google Calendar in your
            profile, I revoke the Google refresh token with Google and delete it from my database; any
            short-lived access token expires on its own within about an hour. Events already created in
            your calendar stay there until you remove them (the App can remove them for you). The
            records described in section 2.3 are deleted when the App removes those events or when you
            delete your account.
          </li>
          <li>
            <strong>Revoking access:</strong> you can also revoke the App's access at any time from{' '}
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
          <li>
            Sync tasks and your schedule (classes, work, travel and study blocks) to Google Calendar, only
            if you've connected it and, for the schedule, after you confirm
          </li>
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
