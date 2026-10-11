// Novidades mostradas em /changelog. Mais recente primeiro. Editar aqui.
export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
