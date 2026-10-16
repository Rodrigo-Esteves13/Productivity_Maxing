// Novidades mostradas em /changelog. Mais recente primeiro. Editar aqui.
export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-10-16',
    title: 'Shared lessons: visit counts and access notifications',
    items: [
      'Visit counter on shared lessons: in the Share panel you see the total visits, how many different people opened the link, and for each one who it was (name, if they have an account), how many times and when they last came.',
      'A visit only counts again after 30 minutes away, so reloading the page does not inflate the number. Your own visits do not count, and visitors without an account are counted without storing their IP.',
      'Private links: set a shared lesson to \"Authorized\" and only people who are logged in and approved by you can open it. Anyone else can request access.',
      'You get a notification when someone asks to open your lesson, and you can approve or decline from the Share panel, choosing if they can only view, suggest changes or co-edit.',
      'The person who asked is notified too, when the request is approved or declined, with a direct link to the lesson.',
      'Suggested changes are notified as well: you are told when an editor suggests changes to your lesson, and the editor is told when you approve or reject them.',
    ],
  },
  {
    date: '2026-10-16',
    title: 'Personal areas, official areas and area proposals',
    items: [
      'Areas are now split in two: official areas, managed by admins and visible to everyone, and your own personal areas, which only you can see and use.',
      'The Areas page is now open to everyone, with \"My areas\" and \"Official areas\" sections, and there is a link to it in the navbar. You can create up to 50 personal areas.',
      'Propose a personal area as official: you can have up to 5 proposals pending at a time. An admin approves or declines them, and if one is approved it becomes official for everyone.',
      'If a proposal is declined, the area stays personal, you see the reason and can fix it and propose again. An area under review cannot be edited, so what gets approved is exactly what was reviewed.',
      'Only the name, color, credits and type are shared when you propose an area. Your tasks, notes and interests stay private.',
      'Admins get a queue to review proposals. They manage official areas and proposals only, never other people\'s personal areas.',
      'Security: tasks (create, edit and import), study sessions, notebook lessons, grade components and interests only accept official areas or your own, and averages only count areas you can access.',
      'Deleting an area that still has tasks now shows a clear message instead of a generic error, and deleting your account also removes your personal areas.',
      'Changing areas now needs a normal login session instead of an API key, and it is rate limited.',
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
