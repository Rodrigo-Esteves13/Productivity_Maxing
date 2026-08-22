// Standard a11y pattern: invisible until a keyboard user Tabs to it, then
// jumps focus straight to <main>, skipping the Navbar's links/search/menu
// button. Tailwind's sr-only/focus:not-sr-only pair does the show/hide -
// no extra CSS needed.
export default function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-violet-600 focus:text-white focus:font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300"
    >
      Skip to content
    </a>
  );
}
