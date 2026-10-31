import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import LegalTable from '../components/Legal/LegalTable';
import useSeo from '../hooks/useSeo';
import { REPO_URL, CONTACT_EMAIL, APP_DOMAIN } from '../lib/constants';

const LAST_UPDATED = '30/10/2026';

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
          Productivity Maxing, also known as PMaxing and available at pmaxing.pt ("the App"), is an open-source, single-developer academic project built and
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
            Task files (optional): files you attach to a task, such as an assignment brief. They are kept
            in the same private storage as notebook files, are only opened through short-lived links, and
            are deleted with the task or with your account
          </li>
          <li>
            Study areas: a shared list of official subjects/categories that I curate, plus any personal
            areas you create yourself (visible only to you). If you propose a personal area as official,
            only its name, color, credits and default type are shown to an administrator for review
          </li>
          <li>
            Shared notebook links: for each link you create, I count how many times it was opened and
            by whom. Visitors who are signed in are shown to you by name; visitors who are not signed in
            are only counted, using a one-way hash of their network address and browser (the address
            itself is never stored). Only you, the owner of the link, can see this; your own visits are
            not counted
          </li>
          <li>
            Push notifications (optional, off by default): if you turn them on, I store your browser's
            push subscription (an address provided by your browser's push service, and its encryption
            keys) and the app language of that device, only to notify you about friend requests, access
            requests, invitations and suggested changes on shared notes and their answers, and, if you turn
            on deadline push reminders, upcoming deadlines (the task title is in the notification). The
            content is encrypted for your browser, so the push service cannot read it. The app asks you
            once per device, when you first open it signed in; nothing is turned on unless you accept, and
            your answer is remembered on that device so you are not asked again. You can turn them off, or
            back on, at any time in your Profile
          </li>
          <li>
            Feedback you choose to send: your message, category, optional rating, the app language and
            the page you were on (without query parameters), together with your account
          </li>
          <li>
            Addresses you choose to add (home, campus, workplaces and one-off events) and how you travel, only to plan travel time in your schedule and study plan. When you press &quot;Calculate automatically&quot;, or when your day has two places in a row, those addresses are sent to Google Maps (Distance Matrix API) to get the trip time. Trip times between your places are kept in your account so they are not requested again. You can clear any address at any time
          </li>
          <li>
            Wellbeing (optional): if you use the Wellbeing page, I store your daily check-ins (mood, and
            optionally energy, stress and a short note) and the medication you add (name, optional dose,
            daily times or &quot;as needed&quot;, and which doses you marked as taken). For &quot;as
            needed&quot; medication, I store each intake you log (date and time, optional dose and a short
            note). If you record blood donations, I store the date, the type (whole blood, plasma or
            platelets) and an optional place. This is health data, processed only with your explicit consent, which you
            give by adding it. It is visible only to you, never shared with friends or other users, and only
            used to show your own reminders, your log and the comparison between your mood and your study
            focus. Before you use medication tracking I also store the version of
            the medication notice you accepted, the language it was shown in and when you accepted it.
            Medication reminders are sent as push notifications that do not include the medication name,
            because they can appear on a locked screen. You can delete any check-in or medication at any time, and deleting your account
            deletes all of it
          </li>
          <li>
            Notes and reminders (optional): personal notes you write on the Notes page (title, text, whether
            it is pinned or done) and the time you ask to be reminded. Only you can see them. At that time
            the App sends a push notification with the note title to your own devices
          </li>
          <li>
            Money (optional): the balance, currency and monthly limits you type on the Money page, each income
            or expense you record (amount, category, date, optional note, whether it repeats monthly) and your
            savings, investment, wishlist and long-term goals. Only you can see them. The App is not connected
            to any bank and only adds up what you write; it is not financial advice
          </li>
          <li>
            Notebook privacy: you can mark an entry as private so friends who can read your notes for that
            subject do not see it, and choose whether new entries start private
          </li>
          <li>
            Pads: text you write in a pad is stored under the pad's name and can be read and changed by
            anyone who opens that name, with or without an account. If you save a pad while signed in,
            the App records your account as the last editor; if you save without an account, it stores a
            keyed hash of your IP address instead (never the address itself), so administrators can see
            that one source spammed several pads and block it from saving. Neither is ever shown to other
            users. Pads nobody edits for 90 days are deleted automatically, except pads locked by an
            account. Pad pages are not indexed by search engines. Do not write private information in a
            pad
          </li>
          <li>
            Shared degree (optional): if you share a program with a class, its members see a copy of its
            semesters, course names, credits and grading weights, and your name as who shared it. Your grades
            are never included. You or the class rep can remove it at any time
          </li>
          <li>
            Classmates: anyone in a class with you can send you a friend request from the Members tab without
            your friend code. Nothing is shared until you accept. A friend&apos;s profile lists the classes you are
            both in
          </li>
          <li>
            Friend links: if you share your friend code as a link, it carries a signature valid for 7 days.
            Whoever opens it in that time sees your name and photo and becomes your friend when they accept,
            without a separate approval from you. After 7 days the same link only sends a normal request
          </li>
          <li>
            Friend requests by email: someone who already knows your email can send you a friend request.
            They are never told whether an account exists, and your email is never shown to them. You can turn
            this off in Social at any time
          </li>
          <li>
            Class deadlines: a test or assignment you add to a class (subject, title, date, weight) is visible
            to its members with your name as who added it, and they get a notification. Members can see how many
            people added it to their tasks, never who. When you add one to your tasks, a normal task is created
            in your account and follows later changes to its title, date and weight
          </li>
          <li>
            Class timetable (off by default): if you turn on sharing in a class, its members see the subject,
            day, time and room of your classes for the next two weeks, merged with other members and never
            with your name, and can copy a subject into their own schedule. Turning it off stops sharing at once
          </li>
          <li>
            Classes: when you create or join a class, its members see your name and profile photo. Notes,
            files and announcements you add to a class are visible to every member, and stay in the class
            if you leave (your name is removed from them if you delete your account). If you delete your
            account while being the only member of a class, that class is deleted with all its files; if you
            were its class rep, the longest-standing member takes over. If you share one of
            your notebook subjects with a class, members can read its entries, except those marked private,
            until you stop sharing or leave the class. Class files are kept in the same private storage as
            notebook files and are only opened through short-lived links
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
        <p className="mt-3">
          Display preferences (for example widget visibility, table density, column and area order, or
          your absence limit), which class announcements you have already seen, and your task templates are saved only in your browser's local storage and
          are never sent to me. When you sign in with Google, Discord or GitHub, or connect Google Calendar, the page you
          came from is kept there for up to 15 minutes so you land back on it, and is deleted once you do.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Google Calendar data: specific disclosure">
        <p className="mb-3">
          Signing in with Google only requests your basic profile (email and name). Calendar access is
          a separate, optional step. If you choose to connect Google Calendar, the App requests this
          one additional scope:{' '}
          <code>https://www.googleapis.com/auth/calendar.app.created</code> (Google describes it as
          making secondary calendars and seeing, creating, changing and deleting events on them).
          It is the narrowest Calendar scope available: it does not give the App access to your
          primary calendar or to any calendar the App did not create.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>What I do with it:</strong> I only <em>create</em>, <em>update</em>, and{' '}
            <em>delete</em> events inside a separate calendar named "Productivity Maxing", which the App
            creates in your Google account the first time you connect. I cannot see, read, or modify
            your primary calendar, your other calendars, or any event I did not create. The events I
            create come from:
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
            write access to events, which a read-only scope can't do. Using a dedicated calendar means
            the permission is limited to that calendar by Google itself, instead of relying on the App
            promising to stay away from your other events. I don't request the broader{' '}
            <code>calendar.events</code> or <code>calendar</code> scopes, which would also cover your
            primary calendar, because the App doesn't need them.
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
            the Productivity Maxing calendar stay there until you remove them (the App can remove them
            for you); you can also hide or delete that calendar yourself in Google Calendar. The
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
          which you grant explicitly on the provider's own consent screen. Wellbeing data (mood check-ins,
          medication and blood donations) is health data and is processed only on the basis of your <strong>explicit
          consent</strong> (GDPR Article 9(2)(a)), given when you choose to add it; you can withdraw it at
          any time by deleting that data.
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
            <strong>Delete</strong> your account and all associated data; use <strong>Delete account</strong> in your Profile, or contact{' '}
            <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
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
