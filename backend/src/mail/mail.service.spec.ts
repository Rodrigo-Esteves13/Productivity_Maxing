import { renderMonthlyDigestEmail } from './mail.service';

const DIGEST = {
  month: '2026-10',
  completedCount: 3,
  studyMinutes: 125,
  averageGrade: 15.3,
  overdueCount: 1,
  topAreaName: null as string | null,
};
const LINK = 'https://app.example.test/review';
const FRONTEND = 'https://app.example.test';

describe('renderMonthlyDigestEmail', () => {
  it('escapes the user-supplied area name', () => {
    const { html } = renderMonthlyDigestEmail(
      { ...DIGEST, topAreaName: '<script>alert("x")</script> & co' },
      LINK,
      'en',
      FRONTEND,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co',
    );
  });

  it('shows the month, the numbers and the review link', () => {
    const { subject, html } = renderMonthlyDigestEmail(
      DIGEST,
      LINK,
      'en',
      FRONTEND,
    );
    expect(subject).toBe('Your October 2026 in review');
    expect(html).toContain('2h 5m');
    expect(html).toContain('15.3');
    expect(html).toContain(LINK);
  });

  it('omits the grade and area rows when there is none', () => {
    const { html } = renderMonthlyDigestEmail(
      { ...DIGEST, averageGrade: null },
      LINK,
      'en',
      FRONTEND,
    );
    expect(html).not.toContain('Average grade');
    expect(html).not.toContain('Most studied area');
  });

  it('localizes the text', () => {
    const { subject } = renderMonthlyDigestEmail(DIGEST, LINK, 'pt', FRONTEND);
    expect(subject).toContain('outubro');
  });
});
