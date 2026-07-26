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
