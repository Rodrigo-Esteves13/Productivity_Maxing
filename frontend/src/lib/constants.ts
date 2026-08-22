// Shared literals used in more than one file. Centralized here so they
// can't silently drift apart (e.g. one Footer link pointing at a renamed
// repo while another still points at the old one).

// GitHub repository URL - referenced from Footer.tsx, FooterBrand.tsx,
// TermsOfService.tsx and PrivacyPolicy.tsx.
export const REPO_URL = 'https://github.com/Rodrigo-Esteves13/Productivity_Maxing';
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;
export const REPO_LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

// Duration a "copied" / "saved" inline confirmation stays visible before
// reverting, used by NewApiKeyModal.tsx and Agent.tsx.
export const COPY_FEEDBACK_MS = 2000;

// SEO - used by useSeo.ts and every page that calls it.
// SITE_URL matches APP_DOMAIN already hardcoded in PrivacyPolicy.tsx /
// TermsOfService.tsx (app.pmaxing.pt) - confirm this is still correct if
// the frontend ever moves domain, and update those two files too.
export const APP_NAME = 'Productivity Maxing';
export const SITE_URL = 'https://app.pmaxing.pt';
export const APP_DOMAIN = SITE_URL.replace(/^https?:\/\//, '');
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const CONTACT_EMAIL = 'support@pmaxing.pt';

// localStorage key for CookieNotice.tsx's dismissed state. Also read by
// StickyMobileCta.tsx (Home.tsx only) - both are `fixed bottom-0` on
// mobile, so the CTA bar stays hidden until the cookie notice is
// dismissed instead of the two silently overlapping at the same screen
// position.
export const COOKIE_NOTICE_DISMISSED_KEY = 'pm_cookie_notice_dismissed';
