# Inventário de funcionalidades (a partir do código)

Data: 2026-10-25. Construído a partir do código (rotas, hosts globais, controllers, jobs, push e mail, service worker, chaves de storage, definições, APIs do browser, variáveis de ambiente, agente Go), não do changelog. Cada linha: funcionalidade | ponto de entrada | o que o utilizador espera | como saberia se falhasse. O resultado da auditoria de cada item está em [silent-bugs-report.md](silent-bugs-report.md).

Jobs do backend: não há agendador dentro da app. O único job periódico é `POST /internal/reminders/run` (prazos, medicação, limpeza de pads), chamado de 15 em 15 min por `.github/workflows/reminders-cron.yml`. O auto-close das sessões de estudo paradas corre de forma preguiçosa dentro de `start()` e `getActive()`. A sincronização com o Google Calendar é iniciada pelo utilizador.

Dados brutos (grep) usados como ponto de partida: rotas de `AppRouter.tsx`, 351 linhas de endpoints, 38 timers do frontend, 62 usos de storage, 163 usos de APIs do browser, 34 variáveis de ambiente do backend e 4 do frontend.

## Área a. Focus, sessões de estudo, plano, horário, calendário, turnos

Static analysis plus targeted unit tests only. No server, no DB, no prisma CLI. No existing file modified.

New test files (all FAIL while the bug exists):
- `backend/src/study-sessions/study-sessions.service.silent-audit.spec.ts` (a-01, a-01b, a-02 x2)
- `backend/src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts` (a-08; run with `TZ=UTC npx jest <path>`, because inside jest on Windows the in-file `process.env.TZ` is not honoured)
- `backend/src/work-shifts/work-shift-copy.service.silent-audit.spec.ts` (a-05)
- `frontend/src/utils/parseIcsSchedule.silent-audit.test.ts` (a-10)

Run: `cd backend && npx jest src/study-sessions/study-sessions.service.silent-audit.spec.ts src/work-shifts/work-shift-copy.service.silent-audit.spec.ts` (5 failed / 5), `TZ=UTC npx jest src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts` (1 failed), `cd frontend && npx vitest run src/utils/parseIcsSchedule.silent-audit.test.ts` (1 failed).

How the "jobs" in this area run: there is no scheduler. Stale-session auto-close is lazy. `StudySessionsService.autoCloseIfStale` runs only inside `start()` and `getActive()` (study-sessions.service.ts:156, :366). Calendar sync is user-driven: `CalendarSyncReviewModal` is triggered by `requestCalendarSyncReview()` after schedule changes, plus the manual button. The .ics feed is computed on request, with a 60 s in-memory cache. `/internal/reminders/run` does nothing for this area (tasks, medications and pads only).

---


Format: name | entry point | user expects | how the user would know it failed

### Focus / study sessions (frontend)
- Focus page | `frontend/src/routes/AppRouter.tsx:121` (`/focus`) | start/stop timer, history, blocks | page error states
- StudySessionProvider (app-wide state) | `frontend/src/context/StudySessionProvider.tsx:53` | one shared active session in every tab | timer disappears or shows the wrong state; often would not know
- Initial load `fetchActive` | StudySessionProvider.tsx:76 | active session restored after open | `error` only rendered on Focus widget (StudySessionWidget.tsx:128)
- Visibility/BroadcastChannel sync `syncActive` | StudySessionProvider.tsx:91,112-123 | tabs agree | errors swallowed (documented); would not know
- Elapsed tick (1 s, from startedAt) | StudySessionProvider.tsx:147 | correct elapsed time | visible clock
- Heartbeat every 60 s | StudySessionProvider.tsx:175-199 | server knows session alive | would not know (a 404 triggers a silent resync)
- `pagehide` stop (keepalive fetch) | StudySessionProvider.tsx:207-219, `api/studySessionsService.ts:103` | stop only when the last tab closes | would not know (see a-03)
- start() | StudySessionProvider.tsx:221 | session starts | generic `ui.couldNotStartSession`, visible only on Focus page
- stop() | StudySessionProvider.tsx:244 | session stops | generic `ui.couldNotStopSession`, visible only on Focus page
- Countdown plan (pmaxing:focus-plan:<id>) | `lib/focusTimer.ts:61,91-94` | Pomodoro countdown survives reload | would not know if storage blocked (documented)
- Break (pmaxing:focus-break) | focusTimer.ts:62,108-120; BreakBanner.tsx | break countdown, then "start next block" | banner
- Tab registry (pmaxing:live-tabs) | `lib/tabPresence.ts:5,57,69` | another open tab keeps the session alive | would not know
- Activity clock (pmaxing:last-activity) | `lib/idleClock.ts:225`, `hooks/useIdleSession.ts` | "still studying?" after 20 min idle | prompt
- Block-end alert (chime + notification) | `components/Study/focus/TimerEndPrompt.tsx:22-27` | alert when the block ends, even in background | would not know (see a-04)
- Break-end alert | BreakBanner.tsx:85-90 | alert when the break ends | would not know
- Notification permission | `lib/focusAlerts.ts:10`, NotifyPermissionHint.tsx, StudySessionWidget.tsx:68, TodayBlocks.tsx:44 | permission asked on Start | hint component
- focusAlerts.notify (SW showNotification, constructor fallback) | focusAlerts.ts:38 (already fixed in the working tree, not re-reported) | notification shown | -
- AudioContext chime | focusAlerts.ts:75 | sound | silent catch (documented)
- GlobalStudyTimer pill and prompts | `components/Study/GlobalStudyTimerHost.tsx`, `GlobalStudyTimer.tsx` | stop from any page | stop error not rendered (a-06)
- IdleSessionPrompt | focus/IdleSessionPrompt.tsx | cut the session at last activity | prompt
- RateFocusPrompt | focus/RateFocusPrompt.tsx | rate focus 1-5 | inline error rendered (fine)
- StopSessionPanel / FocusModeOverlay ("stop + mark task done") | `hooks/useStopSession.ts:206` | session stops and the task is completed | task failure swallowed (a-07)
- TodayBlocks "Start" | focus/TodayBlocks.tsx:43 | session bound to the plan block | provider error on Focus page
- Session history / manual / edit / delete | focus/SessionHistoryCard.tsx, `lib/sessionWindow.ts` | add or fix past sessions | inline errors
- BestTimesHeatmap | components/Study/BestTimesHeatmap.tsx | when I study best | would not know (a-08)
- Browser APIs used: Notification, ServiceWorkerRegistration.showNotification, AudioContext, BroadcastChannel (`lib/focusChannel.ts`), localStorage, fetch keepalive, pagehide/visibilitychange, Fullscreen (`lib/fullscreen.ts`). No Wake Lock.

### Study sessions (backend)
- POST /study-sessions/start | study-sessions.controller.ts:34, service :150 | start (auto-closes stale first) | 409 generic in UI
- PATCH /study-sessions/:id/stop | controller :63, service :196 | stop | 400/409 generic in UI (a-01)
- POST /study-sessions/:id/heartbeat | controller :79, service :348 | keep alive | would not know
- GET /study-sessions/active | controller :88, service :361 | current session (lazy auto-close) | would not know (a-02)
- POST /study-sessions/manual, PATCH /:id, DELETE /:id | controller :42,:127,:137 | manual sessions | inline errors
- GET /study-sessions/history | service :241 (take 300, max 90 days) | recent history | silent truncation above 300 rows / 14 days default (acceptable)
- GET heatmap / daily-totals / time-by-area / streak | service :394, :454, :505, :569 | dashboard stats | would not know
- Lazy job autoCloseIfStale (10 min threshold) | service :652 | forgotten sessions closed at the last heartbeat | note "Auto-stopped..." in history only

### Study plan
- GET /study-plan | study-plan.controller.ts:35, service :130 | blocks around classes, shifts, commute, quiet hours | card error
- GET /study-plan/courses, grade-projection, focus-effect, focus-trend, focus-scatter | controller :55-:103 | stats cards | card errors
- PATCH /study-plan/settings (dailyStudyLimitMinutes) | controller :105, service :651; read by generate :139 and the Focus DayProgressCard | limit applied | `hook.couldNotSaveTheDailyLimit`
- Quiet hours (User.quietHoursStart/End) | saved in CommuteSettingsCard.tsx; read by study-plan generate (buildFreeSlots) and reminders | plan avoids quiet hours | -
- Frontend: `hooks/useStudyPlan.ts`, StudyPlanCard, plan/DailyLimitControl, plan/EstimateEditor | - | errors rendered

### Schedule
- /schedule page | AppRouter.tsx:125, `pages/Schedule.tsx` | week/month timetable | error states
- View preference (localStorage `STORAGE_KEY` in useScheduleView) | `hooks/useScheduleView.ts:13-34` | remembered week/month | -
- Week grid | `hooks/useSchedule.ts`, WeekGrid.tsx | classes by day | error state
- Work-shift overlay | `hooks/useWorkShiftRange.ts:12-20` | shifts shown on the grid | errors swallowed, shifts vanish (documented; Suspected a-S4)
- Month grid | `hooks/useMonthAgenda.ts`, MonthGrid.tsx | classes, shifts, task chips | error state
- Attendance toggle (optimistic, rollback + toast) | useSchedule.ts:75, WeekGrid.tsx:63; PATCH /schedule/:id/attendance (controller :129) | saved | toast on failure (fine)
- GET /schedule/attendance, /schedule/study-vs-class | controller :77, :104 | summaries | card errors
- .ics import (client parse, POST /schedule/import) | `hooks/useScheduleImport.ts:68`, `utils/parseIcsSchedule.ts:67`; controller :44, service :48 | classes replaced within the file's date range | counts shown (imported/failed/removed) and parse errors listed
- Import options (localStorage `pmaxing.scheduleImportOptions`) | useScheduleImport.ts:22 | remembered | -
- DELETE /schedule (delete imported) | controller :145, service :268 | removes classes | toast
- POST /schedule/commute/estimate, POST /commitments/commute/estimate | schedule.controller :180, commitments.controller :66 | Google Maps estimate (503 without key) | inline error
- Itinerary (travel legs) | `schedule/itinerary.service.ts:50`, `maps/travel-times.service.ts` | travel between places | would not know (lookups capped at 10 per call, documented)

### Work shifts / commitments
- GET/POST/PATCH/DELETE /work-shifts, GET /work-shifts/range | work-shifts.controller.ts:38-94, service | shifts saved and expanded | inline error (useCommitments.ts:62)
- POST /work-shifts/copy-week | controller :72, work-shift-copy.service.ts | copy a week or make it weekly | result counts shown; data dropped (a-05)
- Commitments CRUD | commitments.controller.ts:34-81 | places with days off | inline error
- Frontend `hooks/useCommitments.ts`, CommitmentsCard, commitments/* (days off disabled in the shift form) | - | -

### Calendar (Google) and .ics feed
- GET /calendar/status | calendar.controller.ts:26 | connected or not | would not know if the cached value is wrong (a-09)
- `useCalendarStatus` module cache | `hooks/useCalendarStatus.ts:10-45` | correct status everywhere | would not know
- Link calendar (full-page `<a href=.../auth/google/link-calendar>`) | ScheduleSyncCard.tsx:48, GoogleCalendarCard.tsx:70 | OAuth | -
- POST/DELETE /calendar/tasks/:id/sync | controller :33, :59; frontend useTasksPage.ts:137, useQuickReschedule.ts:49, useTaskSelection.ts:75 | task event created/updated/removed | failures swallowed (documented, see a-S2)
- Schedule sync preview/sync/remove-all | schedule-sync.controller.ts:37,:56,:69; service :71,:76,:139 | classes, shifts, travel, study blocks in Google | modal shows counts, `failed` and errors
- Auto review modal | `hooks/useCalendarSyncReview.ts:27-55`, mounted in AppRouter.tsx:212 | asks Confirm/Deny after changes | silent on automatic preview failure (documented)
- .ics feed manage GET/POST/DELETE /calendar/feed | calendar-feed.controller.ts:38-57 | link created or rotated | toast
- Public feed GET /feed/:token.ics | calendar-feed.controller.ts:72, service :121 | subscribed calendar updates | would not know

---

## Área b. Tasks, packs, áreas, notas, programas, boletim, previsão

Auditoria estática + testes unitários novos (sem backend, sem BD, sem dev server). Todos os caminhos `backend/...` e `frontend/...` são relativos a `D:\Productivity_Maxing`.


Formato: nome | entry point | o que o utilizador espera | como saberia que falhou

### Tasks (backend `backend/src/tasks`)
- GET /tasks/meta | tasks.controller.ts:42, tasks.service.ts:987 (cache TaskMetaCacheService) | catálogo de tipos/prioridades | seletores vazios
- GET /tasks/weekly-review | tasks.controller.ts:48, weekly-review.service.ts | resumo da semana | página /review vazia ou erro
- POST /tasks | tasks.controller.ts:53, tasks.service.ts:82 | criar task (período = activePeriodId se omitido) | erro no formulário (500 genérico)
- GET /tasks?periodId= | tasks.controller.ts:58, tasks.service.ts:157 | lista do período ativo/escolhido/'all' | lista vazia
- GET /tasks/today | tasks.controller.ts:69, tasks.service.ts:230 | plano do dia (Focus TodayPlan) | não saberia (lista simplesmente mais curta)
- GET /tasks/overdue-checkins | tasks.controller.ts:77, tasks.service.ts:612 | pergunta diária "já está feito?" | não saberia
- PATCH /tasks/bulk-status | tasks.controller.ts:85, tasks.service.ts:711 | concluir/mudar estado em massa | ver B-07 (não saberia)
- PATCH /tasks/bulk-reschedule | tasks.controller.ts:99, bulk-reschedule.util.ts | mover seleção para um dia | toast de erro
- PATCH /tasks/reorder | tasks.controller.ts:113, tasks.service.ts:194 | ordem manual (drag-and-drop TaskGrid) | toast de erro; ver B-12
- POST /tasks/bulk-delete | tasks.controller.ts:121, tasks.service.ts:745 | apagar seleção | ver B-07
- POST /tasks/import | tasks.controller.ts:135, tasks.service.ts:785 | import Excel/CSV, sucesso parcial por linha | modal com linhas falhadas (numeração errada, B-13)
- GET/PATCH/DELETE /tasks/:id | tasks.controller.ts:144-170, tasks.service.ts:258/268/686 | ver/editar/apagar | erro no formulário; ver B-03, B-05
- PATCH /tasks/:id/overdue-checkin | tasks.controller.ts:158, tasks.service.ts:654 | marcar feita / adiar N dias | ver B-01, B-08
- Subtasks CRUD/bulk/reorder/convert | subtasks.controller.ts:35-94, subtasks.service.ts, tasks.service.ts:432 | checklist | toasts em SubtaskChecklist.tsx
- Anexos | task-attachments.controller.ts:41-81, task-attachments.service.ts | ficheiros por task (max 10) | erro 400 visível
- Recorrência (spawnNextRecurrence) | tasks.service.ts:488, recurrence.util.ts | próxima ocorrência ao concluir | não saberia (B-01)
- Revisões espaçadas | tasks.service.ts:557 (User.spacedReviewsEnabled) | +1/+3/+7 dias | não saberia
- Pin | PATCH isPinned, useTasksPage.ts:440 | fixar no topo | toast de erro

### Tasks (frontend)
- Rotas /tasks, /dashboard, /review | routes/AppRouter.tsx:118, 91 | -
- useTasksPage.ts (create 156, update 268, duplicate 325, complete 380, kanban 397, moveToArea 423, pin 440, reorder 457)
- TaskForm / TaskEditForm / buildTaskPayload | utils/taskPayload.ts:14 | gravar o que está no formulário | não saberia ao limpar campos (B-05)
- useQuickReschedule.ts:19 ("+1 Day", swipe) | mover para amanhã | não saberia (B-09)
- useTaskSelection.ts + BulkActionsBar.tsx | ações em massa | B-07
- useCompleteWithUndo.ts | concluir com Undo | toast
- useOverdueCheckins.ts + OverdueCheckinModal.tsx (montado em PageLayout.tsx:37, por página) | storage `pmaxing:lastOverdueCheckDate` | B-08
- useTaskImport.ts + utils/parseTaskImportFile.ts (SheetJS, cellDates) + TaskImportModal.tsx | B-13, S-03
- Export CSV/Markdown | components/Dashboard/TaskExportButtons.tsx, utils/taskExportFormats.ts | exporta o que se vê
- Quick add (Ctrl+K) | CommandPalette.tsx:423, lib/parseQuickAddTask.ts | storage `pmaxing-quick-add-last-area` | erro no palette
- Templates | useTaskTemplates.ts, storage `pm-task-templates` (só este browser, documentado)
- Prefs locais: `pm-show-archived-tasks`, sort mode, view, densidade, ordem de colunas, filtros guardados (useSavedFilterViews) | best-effort, documentado

### Task packs
- GET/POST/DELETE /task-packs, GET /task-packs/code/:code, POST .../import | task-packs.controller.ts:29-70, task-packs.service.ts | partilhar/importar lista de tasks | resultado por item em ImportTaskPack.tsx:46
- Frontend: /task-packs, /packs/:code (AppRouter.tsx:154/158), useTaskPacks.ts, useTaskPackImport.ts

### Áreas e interesses
- POST /areas, POST /areas/official, GET /areas/proposals, PUT /areas/visibility, PUT /areas/:id/visibility, GET/PATCH/DELETE /areas/:id, propose/withdraw/approve/reject | areas.controller.ts:62-230, areas.service.ts | gerir cadeiras privadas/oficiais | toasts em useAreasPage.ts; DELETE ver B-04
- GET/PUT/DELETE /area-interests/:areaId | area-interests.controller.ts:29-48 | interesse 1-5 (lido por study-plan/focus-effect.service.ts:50) | rollback + erro em useAreaInterest.ts
- Frontend: /areas, AreaDetailView, AreaInterestPicker, storage de ordem `useAreaOrder.ts`

### Notas (componentes), médias, boletim
- /grade-components (list, weight-budget(s), CRUD, entries) | grade-components.controller.ts:66-158, grade-components.service.ts, weight-budget.ts | componentes e entradas de nota, limite 100% | erro do servidor mostrado no painel
- GET /programs/:id/average, /credits, /periods-comparison; GET /periods/:id/average, /report-card | programs.service.ts:103-208, periods.service.ts:205-291, grade-average.util.ts | médias, créditos, boletim | GpaSummary/ProgramsOverviewCard só console.error (S-05); ReportCard mostra ErrorState
- Frontend: GpaSummary.tsx, GpaTrendChart.tsx, ProgramsOverviewCard.tsx, /report-card (ReportCard.tsx, usePeriodReportCard.ts), useGradeComponents.ts, usePeriodGradeComponents.ts, useWeightBudget(s).ts

### Programas e períodos
- /programs CRUD, /periods CRUD + archive/restore/pin/activate | programs.controller.ts:32-98, periods.controller.ts:30-98 | organizar semestres; período ativo guardado em User.activePeriodId | ver B-02
- resolveActivePeriodId (self-healing "General") | periods.service.ts:319 | -
- Frontend: AcademicContext.tsx (load 88, switchPeriod 175, switchProgram 202), ArchivePeriodButton.tsx, ManagePeriodsModal.tsx | activatePeriod falha só com console.error

### Previsão
- POST /predictions/duration, GET /predictions/accuracy | prediction.controller.ts:16/24, prediction.service.ts | estimativa de duração no formulário e no detalhe | "insufficient data" ou nada
- Treino em memória (modelCache, por processo), MLP com fallback para regressão (prediction.service.ts:508, log warn)
- predictForTasks / getCalibrationFactor usados pelo study-plan
- Frontend: useDurationPrediction.ts (debounce 500 ms), TaskFormFields.tsx:96, TaskDetailView.tsx:33

Timers da área: debounce de useDurationPrediction; setTimeout de 2 s do "copiado" em TaskPackList. Sem jobs de backend na área (overdue check-in é pull do frontend em cada página).

## Área c. Caderno, pads, social, turmas, partilhas

Static analysis + 2 new failing repro tests. No existing file modified. Paths are relative to `D:\Productivity_Maxing`.

New test files (both FAIL today, as intended):
- `backend/src/notebook/notebook.service.silent-audit.spec.ts` (C-08) - run: `npx jest src/notebook/notebook.service.silent-audit.spec.ts`
- `frontend/src/components/Notebook/entry/notebookEntryDate.silent-audit.test.ts` (C-05) - run: `npx vitest run src/components/Notebook/entry/notebookEntryDate.silent-audit.test.ts`

---


Format: name | entry point | what the user expects | how the user would know it failed

### Frontend routes / pages
- Notebook page | frontend/src/routes/AppRouter.tsx:130, frontend/src/pages/Notebook.tsx:75 | pick subject, list, open, create, search, export | areas/list errors render ErrorState; entry load error has Retry
- Pad picker + pad | AppRouter.tsx:95-96, pages/Pad.tsx:17, components/Pad/PadEditor.tsx:21 | dontpad-like shared text that saves itself | SaveStatusText ("Could not save. Keep typing..."), conflict banner
- Turmas list / page / note / subject entry | AppRouter.tsx:97-100, pages/Turmas.tsx, TurmaPage.tsx, TurmaNote.tsx, TurmaSubjectEntry.tsx | classes, announcements, notes, files, shared subjects | ErrorState on load; FormError on actions
- Public share page | AppRouter.tsx:110, pages/SharedNotebookEntry.tsx:40 | read a shared lesson; request access; accept invite; propose/edit | gate states, error text
- Social | AppRouter.tsx:150, pages/Social.tsx:29 | friends, requests, shared with me, my shares, notes access | ErrorState only for the overview; most actions give no feedback on failure (C-10)
- Friend profile | AppRouter.tsx:138, pages/FriendProfile.tsx | what you share with one friend, invite to a note, ask for notes | ErrorState on load; askNotes failure silent (C-10)
- Friend notes list / entry | AppRouter.tsx:142-146, pages/FriendNotes.tsx, FriendNoteEntry.tsx | read a friend's granted subjects | ErrorState
- /shared-with-me | AppRouter.tsx:161 | redirects to /social | n/a
- Admin: friend code requests, pads admin | AppRouter.tsx:182-184 | moderation | error text present

### Notebook components / hooks
- Entry editor + autosave | components/Notebook/NotebookEntryEditor.tsx:52, hooks/useEntryAutosave.ts:29 | edits save 1.5 s after typing, Ctrl+S, Done, on leave | toolbar status + Retry while mounted; nothing after unmount (C-06)
- Autosave on/off pref | hooks/useNotebookAutosavePref.ts (localStorage `pm-notebook-autosave`) | per-device toggle, read by useEntryAutosave | n/a
- Entry draft | hooks/useEntryDraft.ts:9 | fields from the entry, reset only on id change | would not know when the server copy changes (C-01)
- Entry list/cache | hooks/useNotebookEntries.ts:49 (10 min in-memory cache) | instant reopen | would not know the cache is stale (C-02, C-04)
- Photos / attachments | components/Notebook/entry/EntryFilesSection.tsx, hooks/useFileUpload.ts | upload/remove | upload error shown; remove error not shown (C-09)
- Useful links | components/Notebook/entry/UsefulLinksSection.tsx, notebookEntryConfig.ts toLinkUrl | add links validated like backend @IsUrl | inline "invalid" flag
- Schedule link | components/Notebook/NotebookScheduleLink.tsx | link subject to .ics subject | save error shown; remove error not (C-09)
- Detect class on create | pages/Notebook.tsx:202-233 | CLASS type + class number when in class | silent fallback to NOTE (documented)
- Search (page) | pages/Notebook.tsx:254 | debounced search | errors show "no results"
- Command palette notebook result | components/CommandPalette/CommandPalette.tsx:487, lib/pendingNotebookEntry.ts (sessionStorage `pmaxing:pending-notebook-entry`) | opens that entry | would not know (C-03)
- Deep link ?entry=&share=1 | pages/Notebook.tsx:302 | open entry + share panel (push targets) | silently ignored on error
- Last subject | pages/Notebook.tsx:54 (localStorage `pmaxing-notebook-area`) | reopen last subject | n/a
- Export entry/course to Markdown | pages/Notebook.tsx:178-200 | download .md | course export error shown
- Share panel | hooks/useEntryShare.ts:85, components/Notebook/NotebookEntryShare.tsx (localStorage `pmaxing.sharePanelOpen`) | link, visibility, requests, invites, proposals, visits | error text; requests/proposals only load in AUTHORIZED (C-12)
- Shared edit form | components/Notebook/SharedEntryEditForm.tsx | CO_OWNER saves, EDITOR proposes | error shown
- Notebook shared panel | components/Notebook/NotebookSharedPanel.tsx | shared-with-me summary in Notebook | hook error flag

### Social components / hooks
- useSocial | hooks/useSocial.ts | overview, add friend, accept/remove/block/unblock, code change | add-friend outcome shown; others return false, ignored (C-10)
- useSocialPending (navbar badge) | hooks/useSocialPending.ts | count of things waiting | failures silent by design
- useNotesAccess | hooks/useNotesAccess.ts | incoming/outgoing notes grants | load failure silent, shows empty (C-10)
- NotesAccessPanel | components/Social/NotesAccessPanel.tsx | approve/deny/change subjects | picker stays open, no message (C-07)
- ShareNoteWithFriend | components/Social/ShareNoteWithFriend.tsx | invite a friend to a note | error shown (wrong text on some 409s, C-15)
- FriendCodeCard | components/Social/FriendCodeCard.tsx | copy code, request new code | clipboard failure silent (code still visible, documented)
- useSharedWithMe / useMyShares / useFriendHub | hooks/*.ts | lists with live refresh | hasError flags

### Pads / turma notes
- useVersionedDoc | hooks/useVersionedDoc.ts:32 | 800 ms debounced save, 3 s poll when saved, 409 conflict banner | status text; nothing on leave (C-13)
- usePad lock/unlock | hooks/usePad.ts:43 | lock with an account | FormError
- useTurmaNote | hooks/useTurmas.ts:94 | same as pad | same

### Backend endpoints / services
- Notebook CRUD | backend/src/notebook/notebook.controller.ts:65-125, notebook.service.ts:280-451 | owner-only CRUD | HTTP errors
- Entry summaries | notebook.controller.ts:79, notebook.service.ts:303 | light list | n/a
- Photos/attachments | notebook.controller.ts:261-332, notebook.service.ts:940-1099 | magic-byte validated upload, signed URLs (1 h) | 400s shown; URL expiry not (C-16)
- Schedule links + detect-class | notebook.controller.ts:334-374, notebook.service.ts:1103-1216 | GET never writes (documented) | n/a
- Search | notebook.controller.ts:376, notebook.service.ts:1228 | max 50 results | silent cap (fine)
- Share link create/revoke/visibility/visits | notebook.controller.ts:130-194, notebook.service.ts:462-802 | token upsert, visits telemetry | n/a
- Access requests + decisions | notebook.controller.ts:196-222, notebook.service.ts:536-699 + push shareAccessRequested/Approved/Denied | owner approves | push failures only logged in PushService
- Proposals | notebook.controller.ts:224-255, notebook-collab.service.ts | EDITOR proposes, owner decides | n/a
- Public share read / request access / shared edit | notebook-share.controller.ts:69-124 | OptionalJwt read, records visit | n/a
- Shared with me | notebook-share.controller.ts:47, notebook-shared-with-me.service.ts (cap 100) | list | silent cap
- Invites | notebook-invite.controller.ts:30-63, notebook-invite.service.ts + push shareInvited/shareInviteAccepted | invite friend with a role | 409/404
- Social hub (friend page, my shares) | notebook-social-hub.controller.ts:25-44, notebook-social-hub.service.ts (cap 100) | counts | silent cap (C-17)
- Notes view grants | notebook-view-grant.controller.ts:40-117, notebook-view-grant.service.ts + push notesRequested/notesGranted | grant read access per subject | 400/404
- Social | social/social.controller.ts:43-121, social.service.ts + push friendRequest | friend codes, requests, blocks | 400/404
- Friend code change requests | friend-code-requests.controller.ts, admin-social.controller.ts | admin rotates code | n/a
- Pads | pads/pads.controller.ts:63-184, pads.service.ts | optimistic save, lock, admin moderation | 403/409
- Pad expiry job | pads.service.ts:178 deleteExpired, called from reminders/reminders.service.ts:160-166 (POST /internal/reminders/run, GitHub cron every 15 min, default branch only) | delete unlocked pads idle 90 days | failure only logged (by design)
- Turmas | turmas/turmas.controller.ts:62-384 and services | membership, notes (optimistic), files, announcements (+push turmaAnnouncement), linked subjects | HTTP errors
- Account deletion cleanup | notebook/notebook-account-cleanup.util.ts, turmas/turma-account-cleanup.util.ts | remove files before cascade | throws (aborts deletion)

### Timers / browser APIs
- Autosave 1500 ms, search debounce 300/250 ms, pad/turma save debounce 800 ms, poll 3 s, live refresh 8-60 s (hooks/useLiveRefresh.ts, visible tab only + push message)
- `beforeunload` only in useEntryAutosave.ts:121; none for pads/turma notes
- `navigator.clipboard` (FriendCodeCard, NotebookToolsPanel, CopyButton) with catch; `crypto.randomUUID` (needs secure context, fine on https); `matchMedia`

---

## Área d. Bem-estar, medicação, lembretes, push, mail, notificações

Audited working tree as of 2026-10-24 (includes the uncommitted medication and Focus-notification edits). Static analysis plus targeted unit tests only. No existing file was modified.

New test files (all EXPECTED TO FAIL while the bugs exist):
- `backend/src/wellbeing/medications.silent-audit.spec.ts` (run: `npx jest src/wellbeing/medications.silent-audit.spec.ts`): 1 control passes, D-01 and D-02 fail.
- `frontend/src/pwa/notifications.silent-audit.test.ts` (run: `npx vitest run src/pwa/notifications.silent-audit.test.ts`): D-03, D-04 and D-05 fail.

Summary: Confirmed 12 (Critical 4, High 5, Medium 1, Low 2). Suspected 9 (Medium 3, Low 6).
Worst five for users: D-01, D-02, D-05, D-06, D-08.

---


Format: name | entry point | what the user expects | how they would know it failed.

### Frontend routes, components, hooks
- Wellbeing page | `frontend/src/pages/Wellbeing.tsx:17` (route `/wellbeing`, `routes.txt:92`) | mood, medication and insights in one place | load errors show ErrorState.
- Mood check-in | `components/Wellbeing/MoodCheckInCard.tsx:19`, `hooks/useMoodToday.ts:7` | today's mood saved once per day | toast on save; would NOT know it went to the wrong day (D-05).
- Medication card (checklist, manage, as-needed log) | `components/Wellbeing/MedicationsCard.tsx:262`, `hooks/useMedications.ts:31` | ticks saved for today, reminders at the set times | optimistic tick rolls back with toast on error; would NOT know about wrong day (D-05) or no reminders (D-08).
- Medication form | `components/Wellbeing/MedicationForm.tsx:29` | name, dosage, schedule, times, reminder toggle | inline errors; times are silently Lisbon time (D-10).
- As-needed intake modal | `components/Wellbeing/IntakeLogModal.tsx` | log one intake | toast on failure.
- Medication disclaimer gate | `components/Wellbeing/MedicationDisclaimer.tsx` | accept notice before adding | backend 403 if not accepted.
- Support lines panel | `components/Wellbeing/SupportLinesPanel.tsx` | emergency numbers always visible | static.
- Insights / burnout cards | `WellbeingInsightsCard.tsx`, `BurnoutAlertCard.tsx`, `hooks/useWellbeingInsights.ts:4` | correlations after enough data | error state.
- Push opt-in dialog at entry | `pwa/PushPermissionPrompt.tsx:13` (mounted `routes/AppRouter.tsx:215`), `pwa/PushPromptDialog.tsx:26` | asked once per account per device | error shown inline; "Later" never asks again.
- Push card in Profile | `components/Profile/PushNotificationsCard.tsx:6` | on/off per device, test button | state text; Test button reports devices/delivered (the only diagnostic).
- Push hook | `hooks/usePushNotifications.ts:43` | state reflects reality | trusts browser subscription only (D-06, D-07).
- Notification preferences | `components/Profile/PreferencesCard.tsx:14` (deadline email/push toggles, saved via PATCH profile) | reminders on/off | toast on save error.
- Quiet hours | `components/Schedule/CommuteSettingsCard.tsx:55` (saved on User) | no deadline reminders in that window | would not know (Lisbon clock, D-10).
- Live refresh on push | `hooks/useLiveRefresh.ts:18` (listens to `pmaxing-push` from SW) | screens refresh on push | polling fallback.
- Focus system alerts (uncommitted fix) | `lib/focusAlerts.ts:38` notify, `:75` playChime; callers `Study/focus/TimerEndPrompt.tsx:22`, `Study/focus/BreakBanner.tsx:27`; permission hint `Study/focus/NotifyPermissionHint.tsx:7` | sound plus system notification at block/break end | would NOT know (D-04, D-14).
- Completion vibration | `lib/completionFeedback.ts:23` | haptic tick | cosmetic.
- In-app toasts | `context/useFeedback` notify | feedback on actions | visible.

### Service worker
- push handler | `frontend/public/push-sw.js:4` (imported via `vite.config.ts:103`) | show notification, message windows | would NOT know about silent replacement (D-03).
- notificationclick | `frontend/public/push-sw.js:30` | open/focus the app at the path | lands on wrong page if navigate rejects (D-20).
- pushsubscriptionchange | missing | subscription kept in sync | would NOT know (D-07).

### Backend endpoints
- `GET/PUT/DELETE /wellbeing/mood[/:date]` | `wellbeing.controller.ts:58,69,82`, `mood.service.ts:43,60,81`.
- `GET /wellbeing/insights` | `wellbeing.controller.ts:93`, `wellbeing-insights.service.ts:50`.
- `GET/POST/PATCH/DELETE /wellbeing/medications` | `wellbeing.controller.ts:103,175,185,196`, `medications.service.ts:116,124,151,191`.
- `GET /wellbeing/medications/day` | `:110`, `medications.service.ts:200`.
- `PUT /wellbeing/medications/:id/doses` | `:207`, `medications.service.ts:231`.
- `GET/POST /wellbeing/medications/disclaimer` | `:119,128`, `medication-disclaimer.service.ts:377,398`.
- `GET/POST/DELETE /wellbeing/medications/intakes` | `:141,152,164`, `medication-intakes.service.ts:262,286,331`.
- `GET /push/public-key`, `POST /push/subscribe|unsubscribe|test` | `push.controller.ts:25,31,41,51`, `push.service.ts:79,83,118,182`.
- `POST /internal/reminders/run` | `reminders.controller.ts:34` (404 without CRON_SECRET, 401 on wrong secret).

### Jobs, push and mail triggers
- Cron | `.github/workflows/reminders-cron.yml` every 15 min, only from default branch (present on origin/main) | reminders run | job fails loudly on non-2xx; partial failures only logged.
- Deadline reminders | `reminders.service.ts:111` (email + push, SentReminder idempotency, quiet hours Lisbon) | 24h before / 09:00 day before.
- Medication reminders | `medications.service.ts:271` sendDueReminders, called from `reminders.service.ts:211` | push at each dose time, within 60 min window | would NOT know (D-01, D-02, D-08).
- Expired pads cleanup | `reminders.service.ts:222` (area c).
- Push delivery | `push.service.ts:130` notifyUser (never throws), `:194` deliverToUser (404/410 delete row, else warn).
- Mail | `mail/mail.service.ts`: reset password `:73`, verification `:104`, password link `:145`, deadline reminder `:184`. SMTP missing: logs error, returns false/void.
- Other push triggers (social/share/turma) use notifyUser/notifyUserOnce (areas c/e); same SW and tag behaviour applies.

### Settings and storage
- User.deadlineEmailReminders / deadlinePushReminders / quietHoursStart / quietHoursEnd: saved via PATCH profile, read by `reminders.service.ts:116-137`.
- Medication.remindersEnabled / active / schedule: read by `medications.service.ts:274`.
- PushSubscription.lang: written at subscribe only (D-11).
- localStorage `pm-push-prompt-answered:<userId>` | `pwa/pushPromptStorage.ts:9,19`.
- Env: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (push off, `public-key` returns null, UI shows "not configured"), SMTP_HOST/PORT/USER/PASS/FROM_EMAIL, CRON_SECRET.

### Browser APIs in area
Notification.permission / requestPermission, ServiceWorkerRegistration.showNotification, PushManager.subscribe/getSubscription, navigator.serviceWorker.getRegistration/ready, AudioContext, navigator.vibrate.

---

## Área e. Auth, perfil, definições, admin, segurança, telemetria, agente Go

Static analysis plus 4 new failing repro tests. No existing file modified. No backend/frontend/DB started.


Format: name | entry point | what the user expects | how the user would know it failed

### Auth (backend `backend/src/auth/auth.controller.ts`, frontend pages)
- Register (password) | auth.controller.ts:96, pages/Register.tsx:44 | account created, session opened (or "check email") | generic "Could not create the account" for every error (409, weak password, 429)
- Login (password) | auth.controller.ts:161, pages/Login.tsx:66 | session opened | every non-blocked/non-unverified error (401, 429, 500, network) shows "Invalid credentials or server error."
- 2FA login step (password path) | Login.tsx:111 + TwoFactorCodeForm.tsx:27 -> auth.controller.ts:185 | wrong code shows "Invalid code" | works on /login
- 2FA login step (OAuth path) | LoginTwoFactor.tsx (/login/2fa#token=) | same | wrong code silently bounces to /login (E-03)
- 2FA status/setup/confirm/disable | auth.controller.ts:200-235, components/Profile/TwoFactorCard.tsx | card shows On/Off; recovery codes once | visible; GET /auth/2fa/status (recoveryCodesLeft) has no reader
- Logout | auth.controller.ts:237, AuthContext.tsx:72 | logs out (all devices, documented) | visible
- Forgot password | auth.controller.ts:261 -> password-auth.service.ts:300 | reset email (generic reply by design) | would not know if SMTP fails (logged only, intended anti-enumeration)
- Reset password | pages/ResetPassword.tsx:79 (Supabase client updateUser) | new password; old sessions killed | would not know old sessions survive (E-02)
- Set/Change password (logged in) | auth.controller.ts:489, hooks/usePasswordForm.ts | password saved, other sessions revoked, success text | success text is wiped immediately (E-10)
- Password link (add password to OAuth account) | auth.controller.ts:136, pages/SetPassword.tsx | password added | visible
- Verify email / resend | auth.controller.ts:123/149, pages/VerifyEmail.tsx, Login.tsx:58 | email verified | visible (only with REQUIRE_EMAIL_VERIFICATION)
- GET /auth/csrf (boot session check) | auth.controller.ts:281, AuthContext.tsx:35 | knows if logged in | checks signature only, not tokenVersion (brief flash then redirect, Low)
- OAuth login Google/GitHub/Discord | auth.controller.ts:310-390, strategies/*.ts, components/Auth/AuthCallback.tsx | logged in | banned users see generic error (E-06); mixed-case email creates duplicate account (E-01)
- OAuth link (profile) | */link guards, oauth-identity.service.ts | provider linked | lands on /dashboard with no confirmation (Low)
- Google Calendar link/disconnect | auth.controller.ts:338/346 | (area a)
- Account blocked (login + mid-session) | account-guard.service.ts:27, Login.tsx:89, AccountBlockedGate.tsx, AccountStatusWatcher.tsx (30s poll, visible tab only) | blocked screen + appeal | password path OK; OAuth path not (E-06)
- Delete account | auth.controller.ts:571 -> auth.service.ts:123, hooks/useDeleteAccount.ts | account + files gone | visible error on failure
- Session cookies/CSRF | cookie.config.ts, guards/csrf.guard.ts, api/client.ts (403 CSRF retry once, 401 redirect) | transparent | see E-03 for 401 side effect

### Profile and settings (where saved / who reads)
- name | PATCH /auth/me (auth.service.ts:55), EditProfileModal | read everywhere
- avatar | POST/DELETE /auth/me/avatar | read everywhere
- commuteMinutes, commuteMode, homeAddress, campusAddress | PATCH /auth/me via CommuteSettingsCard.tsx:115 | read by study-plan.service and schedule commute estimate | cannot be cleared (E-05)
- quietHoursStart/End | PATCH /auth/me via CommuteSettingsCard.tsx:124 | read by study-plan.service.ts:134, reminders.service.ts:211 | cannot be cleared (E-05)
- dailyStudyLimitMinutes | study-plan.service.ts:654 | read study-plan.service.ts:140
- deadlineEmailReminders / deadlinePushReminders | PreferencesCard.tsx | read reminders.service.ts:58-125
- spacedReviewsEnabled | PreferencesCard.tsx | read tasks.service.ts:563
- notesPrivateByDefault | PreferencesCard.tsx | read notebook.service.ts:355
- twoFactor* | two-factor.service.ts | read login + buildProfile
- Accessibility prefs (theme, font, contrast, colorblind, motion, celebrate) | localStorage `accessibility-prefs`, useAccessibilityPrefs.ts | read by CSS attrs on <html>, completionFeedback.ts | two hook instances drift (E-S7)
- Data export | GET /users/me/export (users.service.ts:204), useDataExport.ts | full GDPR export | missing data (E-09)
- No setting found that is saved but never read; reader-without-writer: GET /auth/2fa/status recoveryCodesLeft (no frontend reader).

### Developer API keys
- list/create/revoke | auth.controller.ts:638-670, api-key.service.ts, pages/Developer.tsx, hooks/useApiKeys.ts | keys listed; new key shown once | load error shows "no keys" empty state; create error has no UI (E-11)
- ApiKeyStrategy / ApiKeyScopeGuard | strategies/api-key.strategy.ts, guards/api-key-scope.guard.ts | TASKS keys never reach admin | fine

### Admin
- Users list/edit/role/delete/suspend/ban/reactivate/export | users.controller.ts, users.service.ts, pages/Users.tsx, AdminUserProfile.tsx, hooks/useUsersPage.ts | effect immediate | toasts on error; ban cache is per process (Suspected E-S4)
- Security logs + stats + purge | security-logs.service.ts, components/Security/* | real attack volume | undercounted / mixed (E-07, E-08)
- Banned IPs | banned-ips.service.ts, guards/banned-ip.guard.ts, BannedIpsCard | IP blocked immediately | fine (single instance)
- Appeals | appeals.service.ts, pages/Appeals.tsx, useAppealsPage.ts (paginated) | approve reactivates | fine
- Feedback | feedback.service.ts:27 (take 300), pages/FeedbackAdmin.tsx | all feedback | hidden truncation above 300 (Low, E-14)
- Friend-code requests | social/friend-code-requests.service.ts:70 (take 200), :86 decide | code rotated on approve | claim + rotate not atomic (Suspected)
- Task types / priorities | task-types.service.ts, priorities.service.ts, TaskMetaCacheService (5 min, invalidated on every write) | change visible | fine
- Pads admin | pads.service.ts:283/311, pages/PadsAdmin.tsx | moderation | writes into SecurityLog (E-08)
- Maintenance mode | common/guards/maintenance.guard.ts (env MAINTENANCE_MODE, only "true"/"1"), MaintenanceGate.tsx | maintenance page | fine; flag parsing differs from other flags (yes/on not accepted, Low)

### Telemetry
- Client errors | ErrorBoundary.tsx:35 -> POST /telemetry/client-error (DTO caps 500/8000 chars) | crash logged | silently dropped if over caps (Suspected E-S2)
- Web vitals | lib/reportWebVitals.ts -> POST /telemetry/web-vitals (axios, swallowed) | CLS/INP/LCP logged | CLS/INP fire on page hide; XHR often aborted on unload (Suspected E-S3)

### Go agent (agent/) and backend/src/agent
- GET/PUT /agent/config | agent-config.controller.ts, agent-config.service.ts (defaults: hasOverdueTasks=true, failMode CLOSED) | rules applied next poll | fine
- Agent page | pages/Agent.tsx, hooks/useAgentConfig.ts | config saved | load error shows skeleton forever (E-11)
- One-click pre-configured download | components/Agent/DownloadSetupButton.tsx | .exe works with no setup | broken (E-04)
- Config load (embedded > env > file) | agent/internal/config/config.go:63, embedded.go | key found | embedded silently overrides a newer -set-key (Suspected E-S5)
- Poll loop | agent/main.go:225 tick; pollIntervalSeconds from server | blocks per rules | 401 (revoked key) treated like outage, keeps last decision (E-13)
- Rule evaluation | agent/internal/rules/rules.go | block only when rules match | date-only tasks counted overdue on due day (E-12)
- Hosts blocker | blocker/hosts.go (adds d and www.d) | site blocked | subdomains (m., music.) not blocked (documented friction tool, Low)
- Process blocker | blocker/process_windows.go:84 | process killed | taskkill errors ignored, logged as "terminated"; names without .exe never match (E-15)
- Tray | tray/*.go | status | shows "blocking active" even when site blocking is disabled for lack of admin (Low)

## Área f. Transversal: service worker, PWA, i18n, datas, offline, várias tabs

Static analysis plus 2 new vitest repro files. No existing file modified. No backend/frontend server started.


### Service worker / PWA
- SW registration | frontend/src/pwa/registerSW.ts:12, main.tsx:24 | app updates itself after a deploy | would not know (auto `window.location.reload()` from vite-plugin-pwa autoUpdate, see F-01)
- Workbox config | frontend/vite.config.ts:46-145 | JS/CSS/icons precached, API never cached, HTML always from network | would not know; offline reload shows the browser error page (F-10)
- API caching | vite.config.ts:113-117 NetworkOnly for /auth/, /agent/, api.pmaxing.pt, localhost | no user data in caches | checked: no runtime cache for API, nothing authenticated cached
- Icon cache | vite.config.ts:120-131 CacheFirst `pmaxing-icons` 30 d | fast icons | n/a
- Push handler | frontend/public/push-sw.js:4-29 | notification appears, open windows refresh | would not know if payload invalid (falls back to default title)
- Notification click | push-sw.js:31-47 | focuses app and opens the path | would not know if `client.navigate` rejects (F-S1)
- SW -> page message `pmaxing-push` | push-sw.js:25-27, hooks/useLiveRefresh.ts:37-43 | screens refresh on push | falls back to polling
- Install prompt | pwa/installPrompt.ts:30, pwa/useInstallApp.ts, pwa/InstallAppCard.tsx | install button (Chrome) or iOS steps | n/a
- Offline banner | pwa/OfflineBanner.tsx, pwa/useOnlineStatus.ts | banner when offline | visible
- Push permission prompt | pwa/PushPermissionPrompt.tsx, pwa/PushPromptDialog.tsx, pwa/pushPromptStorage.ts | asked once per user | would not know on shared device (F-03)
- Manifest shortcuts | vite.config.ts:82-98 (/tasks?new=1, /dashboard, /schedule, /focus) | long-press shortcuts | checked: all routes and `new=1` handled (useTasksPage.ts:216)
- Netlify headers/redirects | frontend/public/_headers, _redirects | no-cache for /sw.js and /index.html, immutable /assets | checked fine

### App-wide hosts/providers (App.tsx, AppRouter.tsx)
- ErrorBoundary | components/ErrorBoundary/ErrorBoundary.tsx | crash screen + telemetry | visible
- I18nProvider | i18n/I18nProvider.tsx | dictionary loaded before render | language switch fails silently offline (F-S5)
- FeedbackProvider | context/FeedbackProvider.tsx | toasts + confirm | checked fine (old confirm resolved false)
- MaintenanceGate | components/Maintenance/MaintenanceGate.tsx | 503 MAINTENANCE_MODE -> full page | visible; no auto-recovery (needs reload)
- AccountBlockedGate / AccountStatusWatcher | components/AccountBlocked/* | blocked screen, polling | visible
- AuthProvider | context/AuthContext.tsx:36-50 | session check via /auth/csrf | any error (5xx/network/cold start) = treated as logged out (F-S4)
- StudySessionProvider | context/StudySessionProvider.tsx | shared focus session, heartbeat 60 s, pagehide stop | F-01
- AcademicProvider | context/AcademicContext.tsx:138-165 | reloads on user change | checked fine
- AccessibilityEffects / CompletionBurst / OfflineBanner | App.tsx | n/a | n/a
- CookieNotice | components/Legal/CookieNotice.tsx | dismiss once | n/a
- CommandPaletteHost (lazy) | components/CommandPalette/CommandPaletteHost.tsx | Ctrl+K / navbar button | F-07
- GlobalStudyTimerHost (lazy, mounts only with session/break/justStopped) | components/Study/GlobalStudyTimerHost.tsx | timer on every page | checked: mount condition matches all its alerts
- RoutePrefetcher | routes/RoutePrefetcher.tsx | idle preload of PRIMARY_PAGES | checked fine (errors swallowed by design, real load retries)
- CalendarSyncReviewModal | components/Schedule/CalendarSyncReviewModal.tsx | auto review after schedule edits | depends on module cache (F-07), English labels (F-06)
- PushPermissionPrompt (lazy) | pwa/PushPermissionPrompt.tsx | see above
- PageLayout overdue check-in | components/Layout/PageLayout.tsx:37 | modal for overdue tasks once a day | F-04

### HTTP client
- axios instance | api/client.ts:9-18 | cookies sent cross-origin | n/a
- CSRF attach | client.ts:56-70 | X-CSRF-Token on writes | n/a
- 503 maintenance | client.ts:98-103 | maintenance page | visible
- 401 ACCOUNT_BLOCKED | client.ts:113-116 | blocked screen | visible
- 403 CSRF refresh + retry once | client.ts:121-137 | old tab keeps saving | F-05 (other user's session)
- 401 generic -> hard redirect /login | client.ts:140-149 | logout on expiry | F-02 (wrong 2FA code), loses `?redirect=`
- GET de-duplication | api/dedupeGets.ts | shared in-flight GETs | checked fine (test exists)
- rawFetch | client.ts:167 | health ping, downloads | checked fine
- API base URL | api/apiBaseUrl.ts:6 | VITE_API_URL | falls back to http://localhost:3000 when missing at build (F-S6)
- Error text | lib/httpError.ts:22 getApiMessage | backend message shown raw (English only) | F-06

### i18n
- Dictionaries | i18n/dictionaries.ts (8 lazy chunks), translateIn fallback lang -> en (if loaded) -> CORE_FALLBACK -> raw key
- check script | frontend/scripts/check-i18n.mjs | parity + placeholder names | blind spots in F-06
- language storage | i18n/storage.ts `pmaxing-language` | per browser only | push language frozen (F-08)

### Dates / time zones
- frontend lib/dateKey.ts (UTC day), lib/weekDates.ts todayUtcAnchored (browser-local day), lib/parseQuickAddTask.ts:92 (local), backend common/date-key.util.ts (Lisbon day via Intl) | F-09
- Heatmap buckets | backend study-sessions.service.ts:412-414 (process tz = UTC), frontend BestTimesHeatmap.tsx:12 labels | F-11

### Multiple tabs
- BroadcastChannel `pmaxing-focus` | lib/focusChannel.ts | other tabs see start/stop | checked fine
- tab registry `pmaxing:live-tabs` | lib/tabPresence.ts | last tab stops the session on close | F-01
- activity `pmaxing:last-activity` | lib/idleClock.ts | idle prompt across tabs | checked fine
- storage event only in useNotebookAutosavePref.ts:17 | other prefs not synced across tabs (acceptable)
- visibility/focus refetch | useLiveRefresh, useVisibleInterval, StudySessionProvider:113-122 | checked fine

### localStorage / sessionStorage keys (writer = reader file unless noted; none cleared on logout)
- `pmaxing:onboarding-dismissed` OnboardingChecklist.tsx:11 | `attendance-absence-limit-pct` useAbsenceLimitPref | `accessibility-prefs` useAccessibilityPrefs (also main.tsx applyStoredPrefs) | `pm-area-order` useAreaOrder | `dashboard-widget-prefs` | `pmaxing.sharePanelOpen` useEntryShare | `pm-exam-mode` | `pm-notebook-autosave` (storage event) | `pmaxing:lastOverdueCheckDate` useOverdueCheckins (F-04) | `dashboard-saved-filter-views` | `pmaxing.scheduleImportOptions` | `pm-schedule-view` | `pm-show-archived-tasks` | `dashboard-table-density` | `pm-tasks-sort-mode`, `pm-tasks-sort-direction` | `pm-tasks-table-column-order` | `pm-tasks-view` | `pm-task-templates` | `pmaxing-language` i18n/storage.ts | `pm_cookie_notice_dismissed` CookieNotice + StickyMobileCta | `pmaxing:focus-plan:<sessionId>` and `pmaxing:focus-break` lib/focusTimer.ts | `pmaxing:last-activity` | `pmaxing-quick-add-last-area` lib/lastUsedArea.ts | `pmaxing:live-tabs` | `pmaxing-notebook-area` pages/Notebook.tsx:54 | `pm-push-prompt-answered:<userId>` (only per-user key) | `pm-install-dismissed`
- sessionStorage `pmaxing:pending-notebook-entry` lib/pendingNotebookEntry.ts (palette -> Notebook) | checked fine
- No orphan keys found (every key has a reader). Leak on shared browser: all non-per-user keys survive logout (F-S7).

### Env vars
- Frontend: VITE_API_URL (missing -> localhost silently, F-S6); VITE_SUPABASE_URL/ANON_KEY (missing -> console.error, reset page broken); DEV (SW off in dev)
- Backend required at boot (main.ts:18-50): JWT_SECRET, API_KEY_SECRET, OAuth ids/secrets/callbacks...; FRONTEND_URL required in prod only
- Backend optional: CRON_SECRET (missing -> /internal/reminders/run 404, so all reminders silently off; cron job sees 404 only), VAPID_* (missing -> push 'unconfigured', UI says so), SMTP_* (missing -> logged error, mails dropped, request still succeeds), GOOGLE_MAPS_API_KEY (manual commute), TWO_FACTOR_ENABLED / REQUIRE_EMAIL_VERIFICATION (accept true/1/yes/on), MAINTENANCE_MODE (accepts only true/1: `yes`/`on` silently ignored, inconsistent with isEnvFlagOn), COOKIE_SECURE, DB_CONNECTION_LIMIT, DB_POOL_TIMEOUT_SECONDS, SUPABASE_*_BUCKET, SMTP_FROM_*, TOKEN_ENCRYPTION_KEY, PRINT_SIMULATION, PORT, NODE_ENV

### Command palette / search
- Nav commands | CommandPalette.tsx:39-160 | every path checked against AppRouter and query handlers (exam=on, view=board, view=month, new=1, tab=requests/shared/mine): all handled
- Task/area lazy fetch | CommandPalette.tsx:249-261 | F-07
- Notebook + turma note search (debounced) | CommandPalette.tsx:268-305 | errors -> empty results (user sees "no results")
- Quick add | CommandPalette.tsx (parseQuickAddTask local date) | checked: uses local day correctly

### Timers (raw-inventory/fe-timers.txt), judged
- StudySessionProvider tick 1 s / heartbeat 60 s | fine (recomputed from startedAt; 404 -> resync)
- tabPresence 5 s beat | fine; `crypto.randomUUID()` at module load throws on plain-http LAN dev (F-S8)
- useHealthCheck 30 s (visible only) | fine
- useLiveRefresh / useVisibleInterval | fine
- useIdleSession 30 s | fine
- useVersionedDoc 800 ms debounce | F-12 (no flush on leave)
- useEntryAutosave debounce + unmount flush + beforeunload | fine
- AccountBlockedPage poll, BreakBanner 1 s, RateFocusPrompt, CompletionBurst, toasts, copy-feedback timers, ResetPassword/SetPassword redirects, usePresence, useUndoHistory, useDurationPrediction, ShareNoteWithFriend, Notebook.tsx:262, useCalendarSyncReview 700 ms, lazyWithPreload whenIdle, focusAlerts chime close, rawFetch timeout | checked, no silent issue in area f (setState-after-unmount timers are harmless in React 19)
