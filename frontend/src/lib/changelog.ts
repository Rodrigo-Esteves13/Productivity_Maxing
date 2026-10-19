// Novidades mostradas em /changelog. Mais recente primeiro. Editar aqui.
export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-10-19',
    title: 'Deadline push reminders, and the app in your language',
    items: [
      'Error and confirmation messages, Dashboard cards, sentences with numbers, bold text or links, tooltips and page titles are now translated into all eight languages.',
      'Weekday names in Schedule follow your language, and repeat labels ("Repeats every 2 weeks") read naturally in each one.',
      'The home page FAQ now matches how sharing and the Google Calendar permission work today.',
      'Deadline reminders can now arrive as push notifications too. Turn on "Deadline push notifications" in Profile, plus notifications on each device you want them on. Quiet hours still apply.',
      'Notifications now show the app icon, and a few security settings were tightened.',
    ],
  },
  {
    date: '2026-10-18',
    title: 'Invite friends to a note, and a tidier menu',
    items: [
      'You can invite a friend to a single note as editor, co-owner or reader. Open Share on the note (link set to Authorized), pick a friend and a role. They get a notification and must accept; access stops as soon as you stop being friends.',
      'Editors propose changes for you to approve, co-owners edit directly, and neither can delete the note or change its sharing. You can cancel an invite or remove someone at any time.',
      'You are notified when a friend accepts. Declining stays quiet.',
      'Your friends\' emails are never shown to you in the sharing panel, only their names.',
      '"Shared with me" now lives inside Social, with pending invitations at the top. The old link redirects there.',
      'The top bar no longer overlaps in long languages (German, Japanese, Korean): the full menu shows on wide screens and the compact menu is used on smaller ones. Profile is in your user menu.',
      'Notification button fixed: it no longer stays disabled forever when the service worker is missing (it now explains why). Pages show skeleton placeholders of their own layout while they load instead of a plain "Loading...".',
      'Search (Ctrl+K), the footer, the Dashboard filters, sorting and the task form fields are now translated, including difficulty and progress labels.',
      'Your friend code can no longer be regenerated on a whim: you now ask an administrator for a new one and say why. An approved request replaces the code (your friends stay); a declined one shows the admin\'s note.',
      'More of the app is translated into all eight languages: Agent, Areas, Focus, Schedule, Notebook tools, Profile, admin pages and many forms.',
      'Languages now load on demand: the app only downloads the language you use, and fetches another one only when you switch. The admin menu is translated too.',
      'The user menu fits its text, and the hover now fills each row up to the rounded corners.',
      'Fixed a loophole where someone refused access to your notes could remove the refusal and ask again.',
    ],
  },
  {
    date: '2026-10-17',
    title: 'Social: friends and reading friends\' notes',
    items: [
      'New Social tab: add friends with a private friend code (no search by name or email), accept or decline requests, and block people. Being friends gives access to nothing by itself.',
      'You can ask a friend to let you read their notes. They choose which courses, you can only read, and removing or blocking the friend cuts access immediately.',
      'Notifications for friend requests and for notes requests and approvals.',
    ],
  },
  {
    date: '2026-10-16',
    title: 'Languages, task packs, commute time and notifications',
    items: [
      'New languages: Chinese, Japanese, Korean, French and German, with system fonts and proper line breaking. These translations are not yet reviewed by native speakers: use Send feedback > "A translation problem" when something looks off. Many screens are still partly in English.',
      'Send feedback from the user menu in any language, with a rating and the page you were on.',
      'Push notifications for share requests and edit proposals, per device, plus a test button in Profile. Shared pages and the owner\'s panel refresh by themselves.',
      'Share shows who visited your link and how often (only you can see it). Anonymous visitors are counted without storing their IP.',
      'Areas are now either official (managed by the admin) or personal (only yours). You can propose a personal area to become official.',
      'Task packs: share a list of tasks (title, date, weight, course and type only) with classmates through a link. They import it into their own account, and the weight limit still applies.',
      'Commute time: add an address to a work shift, class place or one-off event to see the travel time.',
      'Fixed days off per place for weekly shifts, and photos from Google, GitHub or Discord follow when you change them there.',
    ],
  },
  {
    date: '2026-10-15',
    title: 'Weight limits, repeat badges and readable notebook tables',
    items: [
      'A course can no longer go over 100% of the final grade: tasks and grade components share the same budget, and the server rejects anything above it.',
      'The task form now shows how much of the course is already assigned and warns when it is still missing a few percent (for example "10% still missing") or when your weight is over the limit.',
      'Repeat is now visible: tasks that repeat show a badge on the card and a Repeat line in their details, and the form explains that the next one is created when you complete the task.',
      'Notebook tables wrap long text instead of cutting it off, in the editor and on shared lessons.',
      'New Dashboard card "Focus and your grades": from your own graded tasks it measures how much each focus point (1 to 5) moved your grade at the same study time, and how much your interest in each course does. It says "not enough data" or "no clear link" instead of guessing.',
      'Focus is now one tap: when a study session ends (timer finished, inactivity prompt or stop button) a small prompt asks how focused you were, and past sessions without a rating show quick rating chips in the history. This is what feeds the "Focus and your grades" card.',
      'The "Focus and your grades" card now has a week-by-week chart of your average focus next to your average grade (both as a % of their scale), so you can see the link forming before there is enough data for a conclusion.',
      'The "Focus and your grades" card also has a dot chart with one dot per graded task: the focus of your sessions in the 14 days before its deadline against the grade you got.',
      'Rate how interested you are in a course (1 to 5) from the course details in Areas. It is private and only feeds that card.',
      'The Dashboard has a new card, "Grade weight still missing", listing every course whose weights do not add up to 100% (or go over it), with a link to add class work or behaviour as a grade component. You can hide it in Customize widgets.',
      'Notebook: when you create a lesson and your schedule has a class running now whose name matches the course, it is marked as a class automatically and the course is linked to the schedule for next time.',
      'Notebook notes sit on faint ruled lines, and shared lessons now use the same sheet as the editor. Editors and co-owners edit in place, with the case tool.',
      'The Dashboard course breakdown now counts grade components (seminars, participation) in each average and in the "% of grade so far" badge.',
    ],
  },
  {
    date: '2026-10-14',
    title: 'Grade components, a new notebook and shared editing',
    items: [
      'Grade components: split a course grade into parts (exam, project, weekly seminars, participation, behaviour) with a weight each. Seminars and class grades are logged as small chips inside the Area, so they never clutter Tasks or the Dashboard.',
      'Each component combines its grades by average, best K of N, or dropping the lowest. The grade projection uses them like any other graded item.',
      'Notebook redesigned: lessons grouped by month with type filter and search, icons on the buttons, and a cleaner editor.',
      'Notebook now saves automatically as you type (Ctrl/Cmd+S still works), and a case tool converts selected text to lowercase, UPPERCASE, Title Case and more.',
      'Sharing with roles: give someone viewer, editor or co-owner access. Editors propose changes and the owner approves or rejects them.',
      'Delete and disconnect dialogs now behave like every other dialog (Esc to close, focus handled, clearer errors).',
    ],
  },
  {
    date: '2026-10-13',
    title: 'Fixed days off, notebook polish and a lighter Google permission',
    items: [
      'Fixed days off: set the weekdays you never work at a place (Schedule > Work and other commitments > edit). Weekly shifts are skipped on those days when you add, replicate or copy, and they no longer appear in the plan, the week view or Google Calendar. One-off shifts still work for swaps.',
      'Study blocks now show the Area name in front, in Focus and in the study plan.',
      'Notebook: the Share panel stays open when you edit, cancel or save a lesson.',
      'Notebook: the whiteboard only shows up when you add it ("Add whiteboard"), so text and photo notes no longer carry an empty board.',
      'Notebook: click a photo to enlarge it (arrow keys to move, Esc to close), also on shared lessons.',
      'Shared lesson links now open inside the normal app layout, with the header and footer.',
      'Profile photo from Google, GitHub or Discord follows the change you make there on your next login. A photo you uploaded yourself is never replaced.',
      'Google Calendar: connecting now asks for a single, narrower permission and uses its own "Productivity Maxing" calendar. Nothing in your other calendars is read or changed.',
    ],
  },
  {
    date: '2026-10-13',
    title: 'Smarter study plan, themes, languages and shift copy',
    items: [
      'Study plan now paces each task across the days until its deadline (a little every day, a bit more as it gets close) instead of waiting for the last week.',
      'Light review sessions keep your active courses fresh even when nothing is due soon.',
      'Importing a timetable now replaces the old classes in that date range, so a class that changed from 3h to 4h no longer shows twice.',
      'Replicate a shift to other days with one click.',
      'Themes: Nightshade, Midnight, Light, Ocean, Forest, Sunset, or match your system.',
      'Languages: English, Portugues and Espanol (navigation, login, settings and new pages).',
      'Accessibility: color-blind friendly colors, reduce motion, bigger text sizes.',
    ],
  },
  {
    date: '2026-10-12',
    title: 'Repeating tasks, weekly review and reminders',
    items: [
      'Repeat: set a task to repeat daily, weekly or monthly; completing it creates the next one (checklist included, reset).',
      'Weekly review page: what you finished, study time by area, what keeps getting pushed back and what is next.',
      'Preferences (Profile): deadline reminders by email and spaced reviews (review tasks 1, 3 and 7 days after you complete an academic task).',
      'Subtasks: drag to reorder, and turn a step into its own task.',
    ],
  },
  {
    date: '2026-10-11',
    title: 'Subtasks, calendar feed and quicker task entry',
    items: [
      'Subtasks: a lightweight checklist inside any task (no weight, no grade, not counted in averages). Add steps when creating a task or from its details; cards show a 2/5 counter.',
      'Eye button on Dashboard tasks opens the task straight in the Tasks page.',
      'Calendar feed (.ics): subscribe in Google, Apple or Outlook Calendar from the Schedule page, no Google permission needed.',
      'Delete all imported classes from the Import dialog, then import the right timetable.',
      'Warning when you pick a date that is already busy while creating or editing a task.',
      'Quick add (Ctrl/Cmd+K, then +) now understands the Area name and priority: "+ Exam SO 12/12 high".',
      'Getting started checklist on the Dashboard.',
    ],
  },
  {
    date: '2026-10-02',
    title: 'Work shifts, places and Google Calendar review',
    items: [
      'Create a place once (name and travel time), then add shifts under it.',
      'Any change that affects Google Calendar opens a Confirm/Deny preview first.',
      'Importing the timetable only adds or updates classes, it never deletes.',
    ],
  },
  {
    date: '2026-10-01',
    title: 'Study plan capacity',
    items: [
      'Study plan shows whether you are on track, need overtime, or cannot fit everything.',
      'Daily study limit slider and better duration estimates.',
    ],
  },
];
