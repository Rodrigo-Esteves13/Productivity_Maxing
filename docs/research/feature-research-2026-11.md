# Feature research, November 2026

Scope: new features for Productivity Maxing that the app does not already have. Every candidate was checked against `frontend/src/lib/changelog.ts`, the command palette routes, `frontend/src/pages/`, `backend/prisma/schema.prisma` and the ideas backlog (`pmaxing_ideias_atualizado(6).txt`), and then searched for with Grep. Anything already shipped or in the current uncommitted work was removed. That work covers task history, task dependencies, type balance, area and difficulty suggestions, checklist from topics, lighter day and badge toasts.

Ranking rule: value to a university student divided by build cost in this stack. Ideas that reuse existing data (tasks, study sessions, grades, areas, schedule, finance, wellbeing) rank higher. Ideas that need a paid API, server-side fetching of user URLs, secret handling, emoji or green in the UI are excluded.

## Market evidence used

- Quizlet: Learn mode (adaptive, moves from multiple choice to typed answers), Test mode (generated practice test with selectable question types and a review of missed answers), Match (timed game). Source: Quizlet help center, "Studying on Quizlet" (help.quizlet.com/hc/articles/360030841732).
- RemNote: flashcards written inside notes (`{{` makes a cloze), image occlusion, an Exam Scheduler that compresses reviews toward a test date and adapts to missed days, and an FSRS option. Sources: remnote.com/feature/flashcards-in-your-notes, remnote.com/feature/exam-scheduler.
- Anki: FSRS gives the same retention with fewer reviews than the SM-2 default and lets the user set a target retention. Source: docs.ankiweb.net/faqs/what-spaced-repetition-algorithm.
- Sunsama: a guided morning planning ritual (pull tasks, estimate, drag onto the calendar, warn when overcommitted) and an evening shutdown ritual (review, reflect, stop). Source: sunsama.com/features/daily-planning-and-shutdown.
- Structured: an inbox of unscheduled tasks you drag into the day, a timeline, Replan for missed tasks, and an Energy Monitor. Source: App Store listing id1499198946.
- Motion: automatic scheduling around deadlines and events. Source: morgen.so/blog-posts/motion-review.
- TickTick: habit tracker with check-ins and best streak, Eisenhower matrix view, focus timer. Source: App Store listing id626144601, tidbits.com (2025-08-14).
- Forest: Plant Together rooms where friends focus together and a session fails for the whole room if one person leaves. Source: forestapp.cc and the App Store listing.
- Focusmate, Flow Club, StudyStream: body doubling and virtual co-working. Source: focusmate.com/faq.
- Habitica: parties for shared accountability. Source: App Store listing id994882113.
- Finch: mood, goal and reflection tracking. Source: Her Campus and university blog reviews.
- When2meet: a group availability heatmap to find a common free slot. Source: savvycal.com/articles/when2meet.
- University assignment calculators (Dallas Baptist University research calculator, University of Waterloo backwards planning worksheet, Michigan Tech): work backward from a due date to dated milestones with buffers. Sources: libguides.dbu.edu/research_calculator, uwaterloo.ca backwards-planning worksheet.
- MyStudyLife (10M+ students): exams, classes and tasks on one calendar, exam countdowns, rotation timetables, holidays pausing classes. Source: mystudylife.com/tour.
- Roundups (Amber Student, cal.com, Fritz ai, 2026): MyStudyLife, Notion, Todoist, TickTick and Structured come up again and again. The features praised most are grade tracking, a timeline day view, habits and a focus timer.

Note: most roundup sources are vendor or affiliate blogs. Product feature claims were taken from official pages or store listings where possible.

## (a) Ranked top 25

### 1. Flashcard practice test mode
- Pitch: generate a practice test from a deck, with multiple choice (distractors taken from other cards' backs), typed answers and true/false, then a score and a review of missed cards.
- Evidence: Quizlet Test mode and Learn mode.
- Builds on: `frontend/src/pages/Flashcards.tsx`, `frontend/src/components/Flashcards/ReviewSession.tsx`, `DeckList.tsx`, `decks.ts`, `backend/src/flashcards/flashcards.service.ts`.
- Effort: S/M. Migration: no.
- Sketch: pure frontend generator `lib/flashcardTest.ts` (shuffle, pick 3 distractors from the same area, normalize accents with the `lib/textSearch.ts` helpers for typed answers). New `components/Flashcards/PracticeTest.tsx` with a setup step (question count, types) and a results list. Optionally feed wrong answers into `POST /flashcards/:id/review` as Again, but only with an opt-in tick. i18n namespace `flashcardTest`.

### 2. Flashcard exam scheduler
- Pitch: when a course has an upcoming test or exam task, its cards are scheduled so every card is seen at least once or twice before the exam date, and intervals never jump past it.
- Evidence: RemNote Exam Scheduler.
- Builds on: `backend/src/flashcards/flashcard-schedule.ts` (SM-2 style, 55 lines), the `Flashcard.areaId` relation, exam tasks (`AcademicTaskType`, `lib/examMode.ts`), `ExamCountdownCard.tsx`.
- Effort: M. Migration: no (the exam date comes from the next exam task in the same area).
- Sketch: in `flashcards.service.ts` look up the next exam task per area. In `flashcard-schedule.ts` cap `intervalDays` so `dueAt` stays before the exam, with a final review 1 day before. Add `GET /flashcards/stats` fields `examAt` and `cardsNotSeenBeforeExam`. Show an "Exam in N days, X cards to go per day" banner in `DeckList.tsx`. i18n `flashcardExam`.

### 3. Cloze cards and cards from notebook text
- Pitch: write `{{answer}}` inside a card (or select text in a notebook entry and press Make card) to get fill-in-the-blank cards.
- Evidence: RemNote inline cloze, Anki cloze note type.
- Builds on: `CardEditor.tsx`, `ReviewSession.tsx`, `components/Notebook/NotebookEntryEditor.tsx`, `CaseTransformBar.tsx` (already acts on a text selection).
- Effort: M. Migration: no (cloze markers live in `front`; `back` can be empty for cloze cards).
- Sketch: `lib/cloze.ts` with parse, mask and reveal functions and unit tests. ReviewSession renders the masked text, then reveals it. A notebook selection toolbar button opens CardEditor prefilled with the selected sentence and the entry's area. Validate the marker count server side in `dto/flashcard.dto.ts`. i18n `cloze`.

### 4. Flashcard import from Quizlet or Anki text export
- Pitch: paste or upload a tab or comma separated file (the format Quizlet and Anki export) and preview the cards before they are created.
- Evidence: Quizlet export (term TAB definition), Anki "Notes in plain text".
- Builds on: the preview-then-confirm pattern of `components/Finance/FinanceImportButton.tsx` and `utils/parseTaskImportFile.ts`, `POST /flashcards`.
- Effort: S. Migration: no.
- Sketch: client parser `lib/flashcardImport.ts` (TAB, comma or semicolon; quoted fields; skip blanks and duplicates; max 500 rows; length limits from `flashcards.constants.ts`). New `POST /flashcards/bulk` with a DTO array limit and `createMany` in one transaction. Add a "Flashcards: import" palette entry. i18n `flashcardImport`.

### 5. Daily plan and shutdown ritual
- Pitch: a 2-minute morning flow (pick today's tasks, see the minutes against your study capacity and classes) and an evening flow (tick what you did, move the rest to a lighter day, write one line about the day).
- Evidence: Sunsama daily planning and shutdown; Structured Replan.
- Builds on: `hooks/useTodayOverview.ts`, `TodayCard.tsx`, `StudyCapacityCard.tsx`, `estimatedMinutes`, `lib/lighterDay.ts`, `PATCH /tasks/bulk-reschedule`, `MoodLog.note` for the one-line reflection.
- Effort: M. Migration: yes for cross-device (`DailyPlan { userId, date, taskIds String[], shutdownAt }`). A v1 that keeps the picked list in localStorage needs no migration.
- Sketch: `components/Dashboard/DailyPlanModal.tsx` and `ShutdownModal.tsx`, opened from the greeting banner and the palette. Endpoints `GET/PUT /daily-plan/:date`. An optional push at the user's chosen wrap-up time goes through the existing reminders cron and SentNotification dedupe, with the kind added to `pushKinds`. i18n `dailyPlan`.

### 6. Common free time finder in Classes
- Pitch: in a class, show a When2meet-style weekly heatmap of when members who share their timetable are all free, to book group work or study sessions.
- Evidence: When2meet and Doodle group availability.
- Builds on: `backend/src/turmas/turma-schedule.service.ts` (opt-in timetable sharing), `components/Turma/TurmaScheduleTab.tsx`, `ClassOccurrence`, `WorkShift`, `ScheduleException`.
- Effort: M. Migration: no.
- Sketch: `GET /turmas/:id/free-time?week=` returns only counts per 30-minute slot (number of sharing members busy) and never event names, so nothing private leaks. Only members with sharing on are counted, and the total is shown. Frontend `TurmaFreeTimeGrid.tsx` uses an accent-intensity heatmap (no green) and a "Best 3 slots" list. Optionally create a Turma deadline or announcement from a slot. i18n `turmaFreeTime`.

### 7. Backward planner for assignments
- Pitch: for a project or paper, pick a template (research, outline, draft, review, final) and get dated checkpoints spread backward from the due date, with buffer days.
- Evidence: university library assignment calculators (Dallas Baptist University, Waterloo, Michigan Tech).
- Builds on: `Subtask` model, `components/Tasks/SubtaskChecklist.tsx`, `lib/checklistFromTopics.ts`, the hand-in date logic, `lib/lighterDay.ts` to avoid busy days.
- Effort: M. Migration: yes (`Subtask.dueOn DateTime?`).
- Sketch: `lib/backwardPlan.ts` gives each phase a percentage of the available days, keeps a 10% buffer and skips holidays and busy days. A preview in the task form or details goes through `POST /tasks/:id/subtasks/bulk` with dates. Overdue checkpoints show on TaskCard and in TodayCard, and the study plan can use the checkpoint as an intermediate deadline later. i18n `backwardPlan`.

### 8. Task trash with restore
- Pitch: deleted tasks go to a Trash for 30 days and can be restored. Deleting is the one action in the app that still has no undo.
- Evidence: Todoist undo, Notion and Google Drive trash. The backlog item #9 notes that delete still has no undo.
- Builds on: `DELETE /tasks/:id`, `POST /tasks/bulk-delete`, `hooks/useCompleteWithUndo.ts` (toast pattern), the cursor pagination in `common/pagination.util.ts`.
- Effort: M. Migration: yes (`Task.deletedAt DateTime?` plus an index; every task query filters `deletedAt: null`).
- Sketch: soft delete in `tasks.service.ts`, with an Undo toast after deleting. `GET /tasks/trash`, `POST /tasks/:id/restore`, `DELETE /tasks/:id/purge`. A daily cron purges after 30 days. Weight budget checks must ignore trashed tasks, and restoring must re-check the 100% weight limit. Calendar sync removes the event on trash and re-creates it on restore. i18n `taskTrash`.

### 9. Time blocking on the week view
- Pitch: drag a task onto the Schedule week grid to reserve a study block at that time. The study plan and Google Calendar respect it.
- Evidence: Structured timeline, Sunsama timeboxing, Notion Calendar, Motion.
- Builds on: `components/Schedule/WeekGrid.tsx`, `WeekDayCell.tsx`, `backend/src/study-plan/study-plan.scheduler.ts` (free-time detection), the Google Calendar sync review modal.
- Effort: L. Migration: yes (`PlannedBlock { userId, taskId?, areaId?, start, end }`).
- Sketch: CRUD under `/schedule/blocks`. The scheduler treats blocks as busy and counts them toward the task's estimate. Use HTML5 drag with a keyboard fallback (select a slot, then Enter). Starting a focus session from a block pre-links the task. Calendar sync adds blocks behind the existing confirm preview. i18n `timeBlocks`.

### 10. Habit tracker grid with weekly targets
- Pitch: habits get a check-in grid (last 12 weeks), a target such as 3 times a week, current and best streak, without creating a new task each day.
- Evidence: TickTick habits, Streaks, Habitica dailies, Finch goals.
- Builds on: the HABIT task type (`lib/typeBalance.ts`), `StudyActivityCard.tsx` (12-week grid), `lib/badges.ts`, the streak rest-day logic (`useStreakRestPref.ts`).
- Effort: M. Migration: yes (`Habit { userId, title, areaId?, targetPerWeek, archivedAt }` and `HabitCheckIn { habitId, date @@unique }`).
- Sketch: `backend/src/habits` module with check-in toggle `PUT /habits/:id/check-ins/:date`. A Habits card on Wellbeing and an optional Dashboard widget. Streaks are computed in a pure util with tests. Optional push through `streak-risk-reminders`. i18n `habits`.

### 11. Focus together with friends
- Pitch: see which friends are in a focus session right now (opt-in), join a shared room with the same timer, and see each other's progress without video.
- Evidence: Forest Plant Together, Focusmate, StudyStream, Habitica parties.
- Builds on: `StudySession`, `components/Study/GlobalStudyTimer.tsx`, `StudySessionWidget.tsx`, `backend/src/social` (friendship checks in `friendship.util.ts`), push.
- Effort: M. Migration: yes (`User.shareFocusPresence Boolean @default(false)`, `FocusRoom { id, hostId, endsAt }`, `StudySession.roomId?`).
- Sketch: `GET /social/focus-presence` returns friends with presence on and an active session (name and minutes only, never the task). `POST /focus-rooms`, invite a friend, then poll every 30s (no websockets needed). The end screen shows a room summary. Presence is off by default and blocked users are never shown. i18n `focusTogether`.

### 12. Course questions log
- Pitch: a per-course list of open doubts to bring to class or office hours, marked resolved with the answer, and visible before a test.
- Evidence: backlog item "Registo de duvidas por resolver, por UC". This is a common study-skills recommendation from university learning centers.
- Builds on: `AreaDetailView.tsx`, `AreaCard.tsx` badges, `PersonalNote` (same shape), the Ctrl+K search in `CommandPalette.tsx`.
- Effort: S/M. Migration: yes (`AreaQuestion { userId, areaId, text, answer?, resolvedAt }`, or `PersonalNote.areaId String?`).
- Sketch: CRUD `/areas/:id/questions` with ownership checks. Show an "N open questions" chip on the Area card and in Exam mode next to the exam countdown. Optionally copy a question to a Turma note. i18n `areaQuestions`.

### 13. Sleep log and its effect on focus
- Pitch: add hours slept (and optional bedtime) to the daily check-in and see how sleep relates to the next day's focus rating, study minutes and distractions.
- Evidence: backlog "Registo de horas de sono"; Bearable and Finch mood-trend tracking.
- Builds on: `MoodLog`, `components/Wellbeing/MoodCheckInCard.tsx`, `backend/src/wellbeing/correlation.util.ts`, `wellbeing-insights.service.ts`, `burnout.util.ts`.
- Effort: M. Migration: yes (`MoodLog.sleepHours Float?`, `MoodLog.bedtimeMinutes Int?`).
- Sketch: extend the check-in DTO with range validation. Add insights fields `sleepVsFocus` and `sleepVsStudyMinutes` with the existing minimum-sample rules. Add a card with a plain-language pattern and "not enough data". Add sleep debt to the burnout signals. i18n `sleep`.

### 14. Exam day leave-by push
- Pitch: on the day of a test or exam, one push says when to leave ("Leave by 08:10 for Exam at 09:00, 40 min trip").
- Evidence: Google Calendar and Fantastical travel-time alerts; MyStudyLife exam reminders.
- Builds on: `TravelTime` cache, `Commitment.commuteMinutes`, the class place via `AreaScheduleLink`/`ClassOccurrence`, `lib/classTimeSuggestion.ts`, `backend/src/reminders/*` with `SentNotification` dedupe, quiet hours.
- Effort: M. Migration: no.
- Sketch: `exam-leave-by-reminders.service.ts` finds exam tasks with a time today, takes the travel minutes from the matching class place (or skips), and sends at leave time minus 10 minutes. Add the kind to the Push notification types card (`pushKinds`). Never call Maps at send time, only use cached values. i18n `pushKinds` plus `leaveBy`.

### 15. Replan overdue
- Pitch: one button spreads all overdue tasks over the lighter days of the next week instead of piling them on today.
- Evidence: Structured Replan, Motion auto-rescheduling.
- Builds on: `lib/lighterDay.ts` (in the current work), `PATCH /tasks/bulk-reschedule` (already per task), `OverdueCheckinModal.tsx`, `AtRiskTasksCard.tsx`.
- Effort: S. Migration: no.
- Sketch: `lib/replanOverdue.ts` assigns each overdue task to the lightest day before its next hard constraint, respecting "Cannot start yet", date certainty and hand-in dates. A preview table lets the user edit and confirm, then one bulk call per target date. The undo toast restores the previous dates. Add a palette entry. i18n `replan`.

### 16. Late-night study alert
- Pitch: when 3 of the last 7 study sessions ended after 01:00, a gentle Wellbeing card (and an optional push) suggests an earlier cut-off.
- Evidence: backlog "Alerta estas a estudar tarde demais outra vez"; Structured Energy Monitor; Apple and Android bedtime reminders.
- Builds on: `StudySession.endedAt`, `study-sessions/session-window.util.ts`, `BurnoutAlertCard.tsx`, the Lisbon time helpers.
- Effort: S. Migration: no.
- Sketch: pure util `lateNightPattern.ts` with tests. Add a `lateNight` field to `GET /wellbeing/insights`. `LateNightCard.tsx` dismissible per week (localStorage). An optional push kind, off by default. i18n `lateNight`.

### 17. Degree progress and graduation forecast
- Pitch: set your degree's total credits and see credits passed, the percentage done and the projected graduation term at your current pace.
- Evidence: university degree audit tools; Power Planner GPA and credit tracking.
- Builds on: `Area.credits`, `CreditsAccumulatedCard.tsx`, `ProgramsOverviewCard.tsx`, `periods.service.ts getReportCard`, approval rules (passed or not).
- Effort: S. Migration: yes (`AcademicProgram.totalCredits Int?`).
- Sketch: add the field to the program DTO and form. Add `GET /programs/:id/progress` (passed credits, credits in progress, average per period, periods left = remaining / average). A progress bar in CreditsAccumulatedCard and a line in Report card. i18n `degreeProgress`.

### 18. Course resources
- Pitch: keep each course's links (Moodle page, slides, book, recordings) and reading list in one place inside the Area.
- Evidence: Notion student "course hub" templates; MyStudyLife class details; backlog "Ligacao a bibliografia/recursos por UC".
- Builds on: `AreaDetailView.tsx`, `NotebookAreaOverview.tsx`, the Turma linked areas for optional sharing.
- Effort: S. Migration: yes (`AreaResource { userId, areaId, title, url?, kind, done }`).
- Sketch: CRUD `/areas/:id/resources`. URLs are stored and rendered only, never fetched by the server (no SSRF). Allow only http and https, and render with `rel="noopener noreferrer"`. A "done" tick turns the list into a reading list. Include it in the data export. i18n `areaResources`.

### 19. FSRS scheduling option for flashcards
- Pitch: an opt-in modern scheduler that reaches the same retention with fewer reviews, with a target retention slider.
- Evidence: Anki FSRS documentation, RemNote FSRS option.
- Builds on: `backend/src/flashcards/flashcard-schedule.ts` and its spec, `POST /flashcards/:id/review`.
- Effort: M. Migration: yes (`Flashcard.stability Float?`, `Flashcard.difficulty Float?`, `User.flashcardScheduler`, `User.targetRetention`).
- Sketch: implement FSRS with the published default parameters in a pure module (or the MIT `ts-fsrs` package), with no per-user optimizer. Migrating existing cards seeds stability from `intervalDays`. Keep SM-2 as the default so the change is reversible. Add a settings toggle on the Flashcards page. i18n `fsrs`.

### 20. Friends weekly study board
- Pitch: an opt-in weekly list of study minutes and tasks finished among friends or a class, with a "Congrats" button.
- Evidence: Forest friends ranking, Duolingo leagues, Habitica parties; backlog "Leaderboard opt-in entre colegas" and "Sistema de da os parabens".
- Builds on: `backend/src/social`, `turmas`, the study-sessions totals, push for kudos.
- Effort: M. Migration: yes (`User.shareWeeklyStats Boolean @default(false)`, `Kudos { fromId, toId, weekKey @@unique }`).
- Sketch: `GET /social/weekly-board` and `GET /turmas/:id/weekly-board` include only opted-in users and show minutes and counts, never grades or task names. Kudos are limited to 1 per friend per week. It resets every Monday. i18n `weeklyBoard`.

### 21. Eisenhower matrix view
- Pitch: a fourth Tasks view that places open tasks in Do, Plan, Delegate or batch, and Drop quadrants from priority and how soon they are due.
- Evidence: TickTick Eisenhower Matrix.
- Builds on: `hooks/useTasksView.ts`, `TaskBoard.tsx` (drag and status menu pattern), `Priority.order`, `weightPercentage`.
- Effort: S. Migration: no.
- Sketch: `lib/eisenhower.ts` treats high priority or a weight of 20% or more as important, and due within 3 days as urgent, with the thresholds in a constant. `TaskMatrix.tsx` reuses `TaskBoardCard`. Dragging between quadrants changes priority only. Add `/tasks?view=matrix` to the palette. i18n `matrix`.

### 22. Floating focus timer (Picture-in-Picture)
- Pitch: pop the running focus timer into an always-on-top mini window that stays visible over the PDF or IDE you are working in.
- Evidence: backlog N31; Chrome Document Picture-in-Picture API; Forest and Flow desktop timers.
- Builds on: `components/Study/GlobalStudyTimer.tsx`, `focus/SessionClock.tsx`, `DistractionButton.tsx`.
- Effort: S. Migration: no.
- Sketch: feature-detect `window.documentPictureInPicture`, hide the button when it is missing, and render a small React root with the clock, a Got distracted button and Stop. Copy the theme CSS variables into the PiP document. Close it on session end. i18n `focusPip`.

### 23. Grade conversion for exchange and applications
- Pitch: show each course and the average on other scales (0-100, an approximate ECTS letter, an approximate US 4.0 GPA) on the Report card, clearly marked as an approximation.
- Evidence: the ECTS Users' Guide grading tables; Erasmus and master's applications that ask for converted grades.
- Builds on: `pages/ReportCard.tsx`, `AcademicProgram.gradeScale`, the approval rules pass mark, `grade-average.util.ts`.
- Effort: S. Migration: no.
- Sketch: pure `lib/gradeConversion.ts` (linear rescale and a configurable band table, with tests). Add a scale selector on the Report card and keep it in the printed view. Add a note that official conversions come from your institution's grading table. i18n `gradeConversion`.

### 24. Semester pattern card
- Pitch: across past periods, see which weeks of the semester are always the heaviest (deadlines, postponements, lowest mood) so you can prepare earlier.
- Evidence: backlog "Analise de sazonalidade"; Spotify Wrapped-style retrospectives.
- Builds on: `AcademicPeriod.startDate`, task dates, `postponedCount`, `MoodLog`, `pages/PeriodReview.tsx`.
- Effort: S. Migration: no.
- Sketch: `GET /tasks/semester-pattern` buckets by week index since period start for archived periods. Card on Period in review: a bar per week, the heaviest 2 weeks named, and "early signal" below 2 periods of data. i18n `semesterPattern`.

### 25. Brain dump to tasks
- Pitch: capture loose thoughts as quick notes and later turn any note into a task (course, date, type prefilled by the existing suggestion hints) in one click.
- Evidence: Structured inbox, Things inbox, Todoist quick capture, GTD inbox.
- Builds on: `pages/PersonalNotes.tsx`, `components/PersonalNotes/PersonalNoteItem.tsx`, `lib/parseQuickAddTask.ts`, `lib/areaSuggestion.ts`, `TaskForm.tsx` (accepts `/tasks?new=1`).
- Effort: S. Migration: no.
- Sketch: add a Make task button on a note that opens the TaskForm prefilled (title from the note title, notes from the body, date from the quick-add parser). After saving, offer to mark the note done. A palette action "Brain dump" opens a new note directly. i18n `brainDump`.

## (b) Quick wins (effort S, no migration)

1. Flashcard import from Quizlet or Anki text (#4).
2. Replan overdue (#15).
3. Late-night study alert (#16).
4. Eisenhower matrix view (#21).
5. Floating focus timer with Picture-in-Picture (#22).
6. Grade conversion on the Report card (#23).
7. Semester pattern card (#24).
8. Brain dump to tasks (#25).
9. Flashcards due today: a Dashboard widget plus one optional daily push ("N cards due"), using `GET /flashcards/stats`, the reminders cron and `SentNotification` dedupe. Not in the top 25 because it is small, but useful.
10. Task funnel card: created, started, completed and on time for the period, from existing `progressStatus`, `completedAt` and the on-time answer. Backlog "Funil de conversao de tasks".

Honorable mention: a Save as image button on Period in review, reusing the chart PNG export (`chartExport`).

## (c) Rejected, and why

- AI tutor, AI summaries, AI flashcard generation, syllabus PDF to tasks with an LLM: these need a paid third-party API, send course content off-platform and add a secret to manage. The rule-based hints already cover the cheap part.
- Generic webhooks, Zapier or Make, Discord webhook: the server would make outbound requests to user-supplied URLs (SSRF) and store secrets.
- Importing classes from an iCal URL (N9) and Moodle scraping: server-side fetching of arbitrary URLs (SSRF), and for Moodle, handling university credentials and possible ToS issues. Upload of an .ics file already exists.
- Video or audio study rooms: WebRTC needs TURN servers (cost) and moderation. #11 gives most of the accountability value without media.
- Apple Health, Google Fit, Wise, Revolut and bank integrations: OAuth secrets plus health and financial data with a high privacy cost. Manual entry already exists in Wellbeing and Money.
- Geofenced reminders and "I am at the faculty" detection: a PWA cannot run background location reliably, and it is a privacy risk.
- Anonymous benchmark against classmates in the same course: course cohorts are small, so k-anonymity cannot be guaranteed and grades could be re-identified.
- Community bank of old exams: copyright and DMCA load, and moderation. Turma files already allow private sharing within a class.
- Telegram, WhatsApp or Slack bots: bot tokens to manage and new attack surface. Web push already covers reminders.
- Full offline mode with queued writes: L effort with conflict resolution across many models. The offline notice and read cache are enough for now.
- Custom fields per area or type, and a user-defined rule engine: high complexity, low value for most students. The many specialized fields already cover the common cases.
- App mascot, seasonal skins, retro mode: low value, and the mascot style leans toward emoji-like visuals, which the project avoids.
- Public portfolio link: little value for students, and it exposes data by default.
- Passkeys (WebAuthn, backlog N12): good security value but not a student feature. Keep it on the security roadmap rather than this list (M effort, migration yes, `@simplewebauthn/server`).
- Already present and so excluded (verified in code or changelog): Gantt timeline, task dependencies, task history, XP and levels, badges, avatar tiers, weekly challenge, single-task mode, greeting, accent unlocks, streak freeze, status summary, month digest, anniversary push, almost-there push, distraction stats, ambient sound across pages, weight vs grade, area consistency, type balance, difficulty and area suggestions, lighter-day suggestion, chart PNG export, money CSV import and export, Period in review, attendance limit, chance of passing, approval rules, grade components, plan mode, exam mode, task packs, Turma deadlines, degree and timetable sharing, pads, notes and reminders, medication, blood donations, burnout alert.
