import PageLayout from '../components/Layout/PageLayout';
import LegalPageLayout from '../components/Legal/LegalPageLayout';
import LegalSection from '../components/Legal/LegalSection';
import LegalLink from '../components/Legal/LegalLink';
import useSeo from '../hooks/useSeo';
import { CONTACT_EMAIL } from '../lib/constants';

const LAST_UPDATED = '20/08/2026';

export default function DmcaPolicy() {
  useSeo({
    title: 'DMCA Policy',
    description: 'How to submit a copyright infringement notice for content on Productivity Maxing.',
    path: '/dmca',
    noindex: true,
  });

  return (
    <PageLayout>
    <LegalPageLayout title="Copyright / DMCA Policy" lastUpdated={LAST_UPDATED}>
      <LegalSection number={1} title="Overview">
        <p>
          I respect the intellectual property rights of others and expect users of Productivity Maxing
          ("the App") to do the same. This policy explains how to report content you believe infringes your
          copyright. It's modeled on the notice-and-takedown process of the U.S. Digital Millennium
          Copyright Act (DMCA); it isn't a claim that the App qualifies for DMCA safe-harbor status, since I
          operate from Portugal rather than the U.S. — it's published as a good-faith, familiar process for
          reporting infringement regardless of where a report comes from.
        </p>
      </LegalSection>

      <LegalSection number={2} title="What this covers">
        <p>
          Almost everything in the App is private data you enter yourself (tasks, grades, notes) — the App
          has no public content feed. This policy exists mainly for the small amount of content that could
          be visible beyond just you: an uploaded avatar image, or anything else made available in a way
          that isn't purely private to your own account.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Filing a notice">
        <p className="mb-3">If you believe content on the App infringes your copyright, send a notice to{' '}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> including:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your name, and if applicable, the entity you represent</li>
          <li>Contact information (email is enough) so I can follow up</li>
          <li>A description of the copyrighted work you claim is infringed</li>
          <li>The specific location of the material in the App (a URL, screen, or clear description)</li>
          <li>
            A statement that you have a good-faith belief the use isn't authorized by the copyright owner,
            its agent, or the law
          </li>
          <li>A statement, under penalty of perjury, that the notice is accurate and that you're the copyright owner or authorized to act on their behalf</li>
          <li>Your physical or electronic signature</li>
        </ul>
      </LegalSection>

      <LegalSection number={4} title="What happens next">
        <p>
          I'll review valid notices and remove or disable access to the reported material where warranted,
          without undue delay, and notify the affected user.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Counter-notice">
        <p>
          If you believe content of yours was removed in error, you can send a counter-notice to the same
          address with: your contact information, identification of the removed material and its prior
          location, a statement under penalty of perjury that you have a good-faith belief the removal was
          a mistake, and your consent to the jurisdiction of the courts of Portugal.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Repeat infringers">
        <p>
          Accounts found to repeatedly upload or share infringing material will have their access suspended
          or terminated, at my discretion.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Contact">
        <p>
          Copyright notices and counter-notices:{' '}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPageLayout>
    </PageLayout>
  );
}
