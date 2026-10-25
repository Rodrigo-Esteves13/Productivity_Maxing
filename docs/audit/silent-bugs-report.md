# Silent bugs: relatório da auditoria (fases 1 a 5)

Data: 2026-10-25. Branch `feat/fase-7-extra-features`, árvore de trabalho com alterações por commitar de outras sessões (medicação, alertas do Focus, breadcrumbs). A auditoria lê o estado atual da árvore, incluindo essas alterações.

Estado: fase 5 concluída (ver a secção 7). Nas fases 1 a 4 não foi alterado código da aplicação; só foram criados ficheiros de teste novos (`*.silent-audit.*`) que reproduzem bugs e **falham de propósito** enquanto o bug existir (lista na secção 6). Inventário completo: [inventory.md](inventory.md).

Método: inventário e caça estática por área (a a f), com um subagente por área. Cada Confirmado tem um teste que falha ou um traço de código preciso. A sessão principal correu todos os testes de reprodução e voltou a seguir no código os findings marcados "re-verificado" na tabela da secção 2. Os restantes Confirmados assentam no traço de código do agente da área, com ficheiro e linha, e estão marcados "traço do agente".

## 1. Resumo

Confirmados únicos (depois de juntar duplicados entre áreas): **74**.

| Severidade | N.º |
|---|---|
| Critical | 4 |
| High | 20 |
| Medium | 24 |
| Low | 26 |

Suspeitos: 46 (ver as secções "Suspected" de cada área, secção 3).

### Os 5 que mais afetam os utilizadores

1. **D-01 + D-02: lembretes de medicação que nunca chegam.** Tomas entre as 23:46 e as 23:59 nunca são lembradas. Marcar uma toma futura e depois desmarcar cancela o lembrete. Nenhum aviso. (Critical, testes a falhar)
2. **B-04: apagar uma Área sem tasks apaga em cascata as notas do caderno e as notas (componentes e entradas).** O aviso só fala de tasks. Numa Área oficial apagada por um admin, perde os dados de todos os utilizadores. (Critical, teste a falhar)
3. **D-05: "hoje" no Bem-estar é o dia UTC e fica fixo desde a montagem.** Entre as 00:00 e a 01:00 de Lisboa (verão), o humor sobrescreve o dia anterior e um tique pode desmarcar a toma de ontem. Uma PWA retomada de manhã mostra as tomas de ontem como se fossem de hoje. (Critical, teste a falhar)
4. **D-06 + D-07: push morre em silêncio enquanto o perfil diz "ligado".** Sem `pushsubscriptionchange`, sem re-sync, e o logout não desliga a subscrição: noutro utilizador no mesmo browser, ou depois de uma rotação, deixam de chegar todos os lembretes (prazos e medicação). (High)
5. **B-05: limpar um campo ao editar uma task não grava nada** (nota real, peso, notas, tópicos, link, estimativas, prioridade). Uma nota real errada fica para sempre no GPA. O formulário fecha com sucesso. (High, 9 testes a falhar)

Logo a seguir: **a-03** (F5, a atualização automática do service worker, ou o link "Ligar Google Calendar" param a sessão de Focus em curso), **E-04** (o .exe "pré-configurado" do agente ignora a key embutida, porque o binário commitado só conhece os marcadores V1) e **C-01/C-02** (edições de co-owner e propostas aprovadas são sobrescritas sem aviso).

### Resultados das verificações (fase 3)

| Comando | Resultado |
|---|---|
| frontend `npx vitest run` | 24 ficheiros, 100 testes OK (antes dos testes de auditoria; com eles, os `*.silent-audit.test.ts` falham de propósito) |
| frontend `npx oxlint` | 0 problemas |
| frontend `npx tsc -b --noEmit` | OK |
| frontend `npm run check:i18n` | 2561 chaves, 8 línguas, 0 problemas (mas ver F-06: o script não deteta textos deixados em inglês) |
| frontend `npx vite build` (produção) | OK |
| backend `npx jest` | 58 suites, 337 testes OK (antes dos testes de auditoria; com eles, os `*.silent-audit.spec.ts` falham de propósito) |
| backend `npx eslint` (sem `--fix`) | 0 problemas. `npm run lint` não foi usado porque inclui `--fix` e reescreveria ficheiros |
| backend `npx nest build` | OK |
| agent `go vet ./...` + `go test ./...` | OK antes da auditoria. Agora `internal/rules` falha por causa do novo `silent_audit_test.go` (E-12). Neste PC, `go test` só corre com `GOTMPDIR` fora de `%TEMP%` (o Application Control bloqueia o .exe de teste lá) |

## 2. Confirmados (índice, do mais grave para o menos grave)

Detalhe completo de cada finding (esperado vs real, evidência, porque é silencioso, correção sugerida e ficheiros) na secção 3, na área indicada pelo prefixo do ID. Coluna "Verif.": **teste** = teste de reprodução que falha (corrido pela sessão principal); **re-verificado** = traço de código seguido de novo pela sessão principal; **traço do agente** = traço com ficheiro e linha feito pelo agente da área.

| ID | Sev. | Título | Onde | Verif. |
|---|---|---|---|---|
| B-04 | Critical | Apagar Área sem tasks apaga notas do caderno e notas de avaliação em cascata | backend/src/areas/areas.service.ts:251 | teste + re-verificado |
| D-01 | Critical | Tomas entre 23:46 e 23:59 nunca são lembradas | backend/src/wellbeing/medications.service.ts:271 | teste + re-verificado |
| D-02 | Critical | Desmarcar uma toma futura cancela o lembrete | backend/src/wellbeing/medications.service.ts:246 | teste + re-verificado |
| D-05 | Critical | "Hoje" do Bem-estar é UTC e fixo desde a montagem; backend usa Lisboa | frontend/src/hooks/useMedications.ts:32, lib/dateKey.ts:10 | teste + re-verificado |
| a-01 | High | Sessão com mais de 16 h nunca pode ser parada (400); auto-close grava 16 h+ | backend/src/study-sessions/session-window.util.ts:29 | teste + re-verificado |
| a-02 | High | Pomodoro com telemóvel bloqueado cortado ou mantido conforme o pedido que chega primeiro | backend/src/study-sessions/study-sessions.service.ts | teste |
| a-03 | High | F5, reload do SW ou link do Google Calendar param a sessão de Focus (pagehide) (= F-01) | frontend/src/context/StudySessionProvider.tsx:206 | re-verificado |
| B-01 | High | Concluir task recorrente pelo overdue check-in termina a série | backend/src/tasks/tasks.service.ts:654 | teste |
| B-02 | High | Arquivar o período ativo deixa-o ativo; tasks novas vão para período arquivado | backend/src/academic-programs/periods.service.ts:111 | re-verificado |
| B-03 | High | Mudar tipo de task académica com subcategoria dá sempre 400 | backend/src/tasks/tasks.service.ts | teste |
| B-05 | High | Limpar um campo ao editar task não grava (nota real, peso, prioridade...) | frontend/src/utils/taskPayload.ts:49 | teste (9) |
| C-01 | High | Edições de co-owner sobrescritas pelo editor aberto do dono (sem versão) | backend/src/notebook/notebook-collab.service.ts:107, frontend/src/hooks/useEntryDraft.ts:24 | re-verificado |
| C-02 | High | Aprovar proposta em modo leitura deixa o texto antigo em cache; edição seguinte reverte | frontend/src/hooks/useEntryShare.ts:276 | traço do agente |
| C-03 | High | Resultado de caderno no Ctrl+K não faz nada já em /notebook; snapshot antigo abre mais tarde | frontend/src/components/CommandPalette/CommandPalette.tsx:487 | re-verificado |
| D-03 | High | Push com a mesma tag substitui o anterior sem som nem vibração (sem `renotify`). Agente: Critical; descido para High (só quando o anterior ainda está na bandeja) | frontend/public/push-sw.js:14 | teste |
| D-04 | High | Alertas do Focus (correção por commitar): mesma tag + requireInteraction sem renotify | frontend/src/lib/focusAlerts.ts | teste |
| D-06 | High | Subscrição push sobrevive ao logout e passa para outra conta; UI diz "ligado" (= F-03) | frontend/src/context/AuthContext.tsx:74 | re-verificado |
| D-07 | High | Sem `pushsubscriptionchange` nem re-sync: lembretes param para sempre | frontend/public/push-sw.js | re-verificado |
| D-08 | High | Lembretes de medicação precisam de push; o cartão do Bem-estar nunca o diz | frontend/src/components/Wellbeing/MedicationsCard.tsx:218 | re-verificado |
| D-09 | High | Push de medicação com TTL 24 h e timestamp de exibição: chega tarde e parece atual | backend/src/push/push.service.ts:224 | re-verificado |
| E-01 | High | Email com maiúsculas diferentes: login dá 500; OAuth cria segunda conta | backend/src/auth/services/password-auth.service.ts | teste |
| E-02 | High | Reset de password não revoga sessões existentes | frontend/src/pages/ResetPassword.tsx:80 | re-verificado |
| E-04 | High | .exe "pré-configurado" ignora a key embutida (binário commitado só tem marcadores V1) | frontend/public/downloads/pmaxing-agent.exe, agent/internal/config/embedded.go:30 | re-verificado |
| E-12 | High | Agente conta tasks só com data como atrasadas no próprio dia (bloqueia apps no dia do exame) | agent/internal/rules/rules.go | teste |
| a-04 | Medium | Alertas de fim de bloco/pausa precisam de JS na página; não chegam com ecrã bloqueado | frontend/src/lib/focusAlerts.ts | traço do agente |
| a-05 | Medium | "Copiar semana" perde morada e transporte de eventos pontuais | backend/src/work-shifts/ | teste |
| a-06 | Medium | Erros do pill global, prompt de fim de bloco e banner de pausa só aparecem em /focus | frontend/src/components/Study/ | traço do agente |
| B-06 | Medium | Média: cada ocorrência de série recorrente conta o peso inteiro | backend grade-average.util.ts | traço do agente |
| B-07 | Medium | "Marcar como feitas"/"Apagar" em massa falham sem mensagem (>200 sempre) | frontend/src/components/Dashboard/BulkActionsBar.tsx:55 | re-verificado |
| B-08 | Medium | Modal de overdue check-in fica bloqueado se a resposta falhar | frontend overdue check-in modal | traço do agente |
| B-09 | Medium | "+1 Day"/swipe usa meia-noite local: no verão fica 00:00 e evento com hora no Calendar | frontend useQuickReschedule | traço do agente (node TZ) |
| C-04 | Medium | Upload/remoção de foto usa `selectedEntry` antigo; repõe texto velho na cache | frontend notebook hooks | traço do agente |
| C-05 | Medium | Entradas novas ficam com o dia UTC e gravam a data errada | frontend notebook entry date | teste |
| C-06 | Medium | Gravação ao sair da entrada falha e as edições perdem-se sem mensagem | frontend/src/hooks/useEntryAutosave.ts | traço do agente |
| C-07 | Medium | Seletor de cadeiras do acesso às notas fica preso; backend 400 sem mensagem | frontend social notes access | traço do agente |
| C-13 | Medium | Pads e notas de turma perdem as últimas teclas ao sair (= F-12; agente c: Low, f: Medium) | frontend Pad / TurmaNote | traço do agente |
| D-10 | Medium | Horas da medicação e quiet hours são hora de Lisboa e a UI não o diz | backend/src/common/date-key.util.ts | traço do agente |
| E-03 | Medium | OAuth + 2FA: código errado faz redirect para /login, erro nunca aparece (= F-02; só com TWO_FACTOR_ENABLED) | frontend/src/api/client.ts:88 | teste |
| E-05 | Medium | Limpar quiet hours, deslocação ou moradas mostra "Saved." mas não muda nada | frontend/src/components/Schedule/CommuteSettingsCard.tsx:120 | re-verificado |
| E-06 | Medium | Utilizador banido/suspenso via OAuth vê erro genérico, sem ecrã de bloqueio nem recurso | backend auth OAuth callback | traço do agente |
| E-07 | Medium | Security logs perdem 429 dentro da janela de 5 s; stats contam linhas | backend/src/common/guards/logging-throttler.guard.ts | teste |
| E-09 | Medium | Export "completo" (RGPD) omite turnos, compromissos, notas, períodos, definições... | backend users export | traço do agente |
| E-13 | Medium | API key revogada (401) tratada como falha de rede; agente bloqueia para sempre | agent/main.go | traço do agente |
| F-04 | Medium | Prompts de overdue check-in perdidos o dia todo após navegação ou reload | frontend useOverdueCheckins | traço do agente |
| F-05 | Medium | Retry automático de CSRF envia escrita de uma tab antiga para outra conta (raro) | frontend/src/api/client.ts | traço do agente |
| F-06 | Medium | ~78 textos por língua ficaram em inglês (fase7.ts 73, meds.ts 5); check-i18n não deteta | frontend/src/i18n/messages/*/fase7.ts | re-verificado (script) |
| F-07 | Medium | Falha temporária guardada como resposta final e mantida após logout (Calendar "não ligado", palette vazia) (inclui a-09) | frontend caches de módulo | traço do agente |
| F-09 | Medium | Três "hojes" diferentes (UTC, local, Lisboa): tasks de hoje aparecem como futuras/atrasadas | frontend/src/lib/dateKey.ts | teste |
| a-07 | Low | "Parar e marcar task feita" ignora falha no update da task | frontend Focus | traço do agente |
| a-08 | Low | Heatmap "melhores horas" agrupa por UTC (backend) e mostra como local (frontend) (inclui F-11) | backend study-sessions heatmap | teste (TZ=UTC) |
| a-10 | Low | Import .ics mantém eventos `STATUS:CANCELLED` como aulas | frontend/src/utils/parseIcsSchedule.ts | teste |
| B-10 | Low | Apagar tasks em massa deixa eventos do Google Calendar órfãos (= a-11) | backend/src/tasks/tasks.service.ts:745 | traço do agente |
| B-11 | Low | Previsão de duração no formulário de criação ignora a Área | frontend useDurationPrediction | traço do agente |
| B-12 | Low | Reordenar com filtro ativo grava ordem diferente da mostrada | frontend TaskGrid | traço do agente |
| B-13 | Low | Import Excel/CSV: erros apontam para a linha errada | frontend import modal | traço do agente |
| C-08 | Low | Limpeza do Storage ao apagar entrada nunca regista falhas | backend/src/notebook/notebook.service.ts | teste |
| C-09 | Low | Apagar no caderno falha sem mensagem | frontend notebook | traço do agente |
| C-10 | Low | Ações sociais falham sem feedback; separador Pedidos pode aparecer vazio | frontend social | traço do agente |
| C-11 | Low | Limpar o número da aula nunca é gravado | frontend notebook | traço do agente |
| C-12 | Low | Badges de pedidos/propostas ficam presos após mudar partilha para Pública | frontend share | traço do agente |
| C-14 | Low | Push sociais mostram nome vazio | backend social push | traço do agente |
| C-15 | Low | Convite a partir da página de amigo mostra mensagem errada em alguns 409 | frontend social | traço do agente |
| C-16 | Low | URLs assinadas de fotos/anexos expiram após 1 h numa entrada aberta | backend notebook signed URLs | traço do agente |
| C-17 | Low | Limites escondidos cortam listas sociais/partilhas sem indicação | backend social/sharing | traço do agente |
| C-18 | Low | Pad bloqueado por outro enquanto escreve: "continue a escrever" enganador | frontend Pad | traço do agente |
| D-11 | Low | Língua dos push fica a de quando subscreveu (= F-08) | backend/src/push | traço do agente |
| D-12 | Low | Emails só em inglês | backend/src/mail | traço do agente |
| E-08 | Low | Moderação de pads aparece como bloqueio de rate-limit; userId vazio | backend security logs | traço do agente |
| E-10 | Low | Mensagem de sucesso ao mudar password apagada logo a seguir | frontend Profile | traço do agente |
| E-11 | Low | Páginas Developer e Agent: falhas parecem estados vazios ou skeleton infinito | frontend Developer/Agent | traço do agente |
| E-14 | Low | Filas de admin cortadas sem aviso (feedback take 300, friend-codes take 200) | backend admin | traço do agente |
| E-15 | Low | taskkill falhado registado como "terminated"; nomes sem ".exe" nunca coincidem | agent/internal/blocker/process_windows.go:84 | traço do agente |
| E-16 | Low | Mensagens de erro de auth genéricas e textos por traduzir | frontend auth pages | traço do agente |
| F-10 | Low | Offline, a PWA instalada não abre (index.html não está em cache) | frontend/vite.config.ts | traço do agente |

Duplicados juntados: F-01 em a-03, F-02 em E-03, F-03 em D-06, F-08 em D-11, F-11 em a-08, F-12 em C-13, a-09 em F-07, a-11 em B-10. Os relatórios de área (secção 3) mantêm os IDs originais.

Relação com o bug que motivou a auditoria (`new Notification` num `catch` vazio): os irmãos diretos são D-04 (a correção por commitar ainda substitui o alerta em silêncio), D-03 (o mesmo no service worker para todos os push), a-04 (alertas do Focus dependem de JS a correr na página) e D-08 (pré-requisito de push nunca explicado no Bem-estar).

## 3. Detalhe por área (Confirmados, Suspeitos, Verificado e OK, Não coberto)

Texto dos relatórios de cada área, sem alterações. A área b foi escrita em português, as restantes em inglês.

### Área a. Focus, sessões de estudo, plano, horário, calendário, turnos

#### Confirmed

**a-01 A Focus session that has run over 16 h can never be stopped; when the tab closes it is saved anyway with the full duration**
- Severity: High
- Where: `backend/src/study-sessions/study-sessions.service.ts:215-218` (stop runs `validateSessionWindow`), `session-window.util.ts` (MAX_SESSION_MINUTES = 960), `autoCloseIfStale` :652-671 (no limit applied), frontend `StudySessionProvider.tsx:256-258`
- Expected: "Stop" closes a session someone forgot overnight with the tab open.
- Actual: the heartbeat keeps the session alive (last beat at most 60 s old, so it is never stale). After 16 h, every `PATCH /stop` returns 400 "A session cannot be longer than 16 hours." The frontend replaces that message with the generic `ui.couldNotStopSession`. That message is shown only on the Focus widget; the global pill and TimerEndPrompt show nothing. The `pagehide` keepalive stop gets the same 400. Once the tabs are closed, `autoCloseIfStale` writes `endedAt = lastHeartbeatAt` with no limit check, so a session of 16 h or more lands in the heatmap, streak, daily totals and predictions.
- Evidence: test `[silent-audit a-01]` fails with `Rejected to value: [BadRequestException: A session cannot be longer than 16 hours.]`. Test `[silent-audit a-01b]` fails: 1140 minutes credited (expected <= 960).
- Why silent: the backend reason is thrown away and replaced by a generic message, which is not rendered outside /focus. The over-long session is then saved without any sign.
- Fix: in `stop()`, clamp `endedAt` to `startedAt + MAX_SESSION_MINUTES` (or to the last activity) instead of rejecting; apply the same clamp in `autoCloseIfStale`. On the frontend, show the API message. Files: study-sessions.service.ts, StudySessionProvider.tsx.

**a-02 A Pomodoro run with the phone locked is silently cut to the moment the screen locked, or not, depending on a request race**
- Severity: High (core Focus flow on phone or installed PWA)
- Where: `StudySessionProvider.tsx:112-123` (visibilitychange calls `syncActive`), :175-199 (heartbeat interval), backend `study-sessions.service.ts:348-359` (the heartbeat revives without a staleness check) and :652-671 (close at the last heartbeat)
- Expected: start a 25/50/90 min block, lock the phone, study, unlock. The block is still running, or at least the app says what happened.
- Actual: a locked or backgrounded mobile page is frozen, so no heartbeat is sent. After 10 min the server considers the session stale. On resume, two requests race:
  - If `GET /active` arrives first (visibilitychange), the session is closed at `lastHeartbeatAt` (minute ~1) and the client sets `activeSession=null`. The timer vanishes, TimerEndPrompt never fires, RateFocusPrompt never appears and no toast is shown. Only the history row carries the note "Auto-stopped...".
  - If the overdue heartbeat arrives first, `updateMany` writes `lastHeartbeatAt=now` and the session continues with the full time.
- Evidence: test `[silent-audit a-02] the outcome must not depend on which request reaches the server first` fails (`closed` vs `running`). Test `... must not be closed at the moment the phone locked` fails (endedAt set).
- Why silent: `syncActive` just replaces the state; nothing tells the user that the session was auto-stopped.
- Fix: when a sync turns a local active session into null without a user action, show a toast "Session auto-stopped at HH:MM. Fix the time?" that links to edit. Make the threshold plan-aware: send the plan end time on start, and don't auto-close before that time plus a margin. Make `heartbeat` refuse (404) once the session is stale, so the outcome is deterministic. Files: StudySessionProvider.tsx, study-sessions.service.ts, StartStudySessionDto.

**a-03 Reloading the page (F5, pull-to-refresh), a PWA auto-update, or clicking "Connect Google Calendar" stops the running Focus session**
- Severity: High
- Where: `StudySessionProvider.tsx:207-219`, `api/studySessionsService.ts:103-119`, `pwa/registerSW.ts:17-22` with `node_modules/vite-plugin-pwa/dist/client/build/register.js` (autoUpdate: on `activated` with `isUpdate`, it calls `window.location.reload()` because no `onNeedReload` is passed), `ScheduleSyncCard.tsx:48` and `GoogleCalendarCard.tsx:70` (full-page `<a href>` navigation)
- Expected: the session survives a reload. The code itself says the countdown plan is re-read "ao mudar de sessao (ou de tab, ou recarregar)" (StudySessionProvider.tsx:125-126).
- Actual: `pagehide` fires on reload and on navigation. With a single tab, `isAnotherTabOpen()` is false, so a keepalive `PATCH /stop` is sent. After the reload, `fetchActive` gets null (or gets the session first and loses it about 60 s later, when the heartbeat returns 404 and `syncActive` runs). The orphan `pmaxing:focus-plan:<id>` key stays in localStorage. No message is shown, and every deploy that a user's open tab picks up ends their block.
- Evidence: code trace above. Not unit-testable here: the frontend has no jsdom or testing-library (vitest node environment).
- Why silent: the stop runs fire-and-forget during unload; the next page simply has no session.
- Fix: remove the `pagehide` stop and rely on the heartbeat auto-close, which already closes at the last heartbeat (accurate to 60 s). If an explicit unload stop is kept, at least skip it when `PerformanceNavigationTiming.type === 'reload'` and pass `onNeedReload` to `registerSW` so it does not reload mid-session. Files: StudySessionProvider.tsx, registerSW.ts.

**a-04 Focus block-end and break-end alerts depend on JS running in the page, so they never arrive on time with the screen locked or the tab frozen (sibling of the known Notification bug)**
- Severity: Medium (works only on desktop with the tab alive)
- Where: `TimerEndPrompt.tsx:22-27`, `BreakBanner.tsx:76-90`, `focusAlerts.ts:1-2` (comment says "funciona com a tab em segundo plano")
- Expected: a notification when the block or the break ends, as the permission request at Start implies (StudySessionWidget.tsx:66-68).
- Actual: the alert fires only when React re-renders with `remainingSeconds === 0`, driven by `setInterval` in the page. On Android/iOS with the screen locked, or with Chrome's background-tab freezing, nothing runs, so the notification appears only when the user comes back, if at all. Combined with a-02, the session is usually auto-closed first, so TimerEndPrompt never shows. There is no server push or `showTrigger` fallback.
- Evidence: code trace. The only scheduler is in-page timers (fe-timers inventory: BreakBanner.tsx:20, StudySessionProvider.tsx:163).
- Why silent: nothing fails; the alert just doesn't happen.
- Fix: on start, schedule a web-push from the backend for the plan end time (the reminders cron is too coarse at 15 min). Alternatively, say clearly in the UI that alerts need the app open. Files: focusAlerts.ts, StudySessionWidget.tsx, push module.

**a-05 "Copy week" drops the address and transport mode of one-off events**
- Severity: Medium
- Where: `backend/src/work-shifts/work-shift-copy.service.ts:32` (`COPY_FIELDS` has no address or commuteMode), `work-shift-copy.planner.ts:11-29,57-65` (ShiftSource/ShiftDraft have neither field)
- Expected: a copied one-off event (no commitment, own address, e.g. walking) keeps its address and transport mode, so the itinerary computes travel to it.
- Actual: copies are created with `address=null` and `commuteMode=null`. `ItineraryService.buildRange` (itinerary.service.ts:88-104) then has no place for them: no direct travel legs, and the user's default mode is used. This changes free slots in the study plan and the travel events in the Google sync and the feed.
- Evidence: test `[silent-audit a-05]` fails; the created data lacks `address` and `commuteMode`.
- Why silent: the copy reports success (`created`, `skipped`), and the grid looks identical because the address is not shown on the chip.
- Fix: add `address` and `commuteMode` to COPY_FIELDS, ShiftSource, ShiftDraft, baseFields and the `create` data. Files: work-shift-copy.service.ts, work-shift-copy.planner.ts (+ spec).

**a-06 Stop/start errors from the global timer pill, the block-end prompt and the break banner are never rendered outside /focus**
- Severity: Medium
- Where: `StudySessionProvider.tsx:234-236,256-258` (only `setError`), `GlobalStudyTimer.tsx:31-38` (does not read `error`), `TimerEndPrompt.tsx:31-38,52`, `BreakBanner.tsx:122-125`; `error` is rendered only in `StudySessionWidget.tsx:128`
- Expected: clicking Stop, "Take a break" or "Start next block" on any page either works or says why not.
- Actual: on failure (network, 409 "already stopped" after an auto-close, 409 "already active" from another device, 400 from a-01), the call returns false and nothing is shown. "Take a break" silently does not start the break. The stale pill stays until the next heartbeat 404 (up to 60 s).
- Evidence: code trace. `grep useActiveStudySession` shows no consumer reading `error` other than the Focus widget.
- Why silent: the error state is set but not rendered on that page.
- Fix: send provider errors to `useFeedback().notify` (toast) instead of only setting state. On a 404 or 409 from stop, call `syncActive()`. Files: StudySessionProvider.tsx (or GlobalStudyTimer.tsx).

**a-07 "Stop and mark task done" silently leaves the task open when the task update fails**
- Severity: Low
- Where: `frontend/src/hooks/useStopSession.ts:214-222`
- Expected: the task is marked complete, or the user is told it wasn't.
- Actual: `bulkUpdateTaskStatus` failure is caught and ignored. The session panel closes as a success, no completion animation plays and no message is shown. The comment explains why the session is not rolled back, but not why the user isn't told.
- Evidence: code trace.
- Why silent: empty catch.
- Fix: `notify(t('...couldNotMarkTaskDone'), 'error')` in the catch (i18n key in all 8 languages). File: useStopSession.ts.

**a-08 The "best times" heatmap and study-plan slot scoring use the server's UTC clock, not Lisbon time**
- Severity: Low
- Where: `backend/src/study-sessions/study-sessions.service.ts:412-415` (`getDay()`/`getHours()`); used by `study-plan.service.ts:664-676` (the comment there admits the shift, but the slot midpoint is in Lisbon minutes, so the "same coordinate system" claim is wrong)
- Expected: a session at 20:30 Lisbon is shown in the 20-24 column.
- Actual: in summer it is shown at 16-20 (UTC 19:30), and Saturday/Sunday boundaries shift at midnight. The rest of the same service (streak, daily totals) already uses `toLisbonDateKey`.
- Evidence: `TZ=UTC npx jest src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts` fails (hourBucket 4 instead of 5).
- Why silent: the chart just looks plausible.
- Fix: derive the weekday and hour with `Intl.DateTimeFormat` in `APP_TIME_ZONE` (as `toLisbonDateKey` does). File: study-sessions.service.ts. Partly documented as known in study-plan.service.ts.

**a-09 A transient /calendar/status failure (or a previous account in the same tab) is cached as "not connected" for the whole session**
- Severity: Medium
- Where: `frontend/src/hooks/useCalendarStatus.ts:26-45` (`.catch` sets `cachedStatus = false` permanently); the cache is invalidated only by AuthCallback.tsx:62 and GoogleCalendarCard.tsx:33, never on email/password login or on logout
- Expected: when the backend is cold or slow (Render free tier), the status is retried, and switching accounts shows the right status.
- Actual: with `false` cached, `useCalendarSyncReview` never subscribes (hook line 45), so no auto-review after schedule changes. The "Add to Google Calendar" checkbox is hidden in TaskFormFields.tsx:93 and ScheduleSyncCard shows "Connect" for a connected user. This lasts until a full reload. After logout and login as another user (password login), the old user's value is shown.
- Evidence: code trace.
- Why silent: an error is turned into a valid-looking answer.
- Fix: don't cache on failure (leave `null` and retry on the next mount or on focus); call `refreshCalendarStatus()` on login and logout. File: useCalendarStatus.ts, auth context.

**a-10 .ics import keeps cancelled events as classes**
- Severity: Low
- Where: `frontend/src/utils/parseIcsSchedule.ts:129-195` (STATUS never read)
- Expected: `STATUS:CANCELLED` events are skipped.
- Actual: they are imported. They appear on the grid, block study-plan slots, count as "not marked" attendance and are pushed to Google and the feed. No parse error is shown.
- Evidence: test `[silent-audit a-10]` fails (1 row instead of 0).
- Fix: skip events with `STATUS:CANCELLED` (count them in a "skipped" line). File: parseIcsSchedule.ts.

**a-11 Bulk-deleting tasks leaves their Google Calendar events behind**
- Severity: Low
- Where: `frontend/src/hooks/useTaskSelection.ts:85-90` (`deleteSelected`); the backend `tasks.service.ts` never touches `googleCalendarEventId` on delete (grep finds no match)
- Expected: the same as single delete (useTasksPage.ts:300-312), which offers to remove the linked event.
- Actual: bulk delete removes the tasks; the events stay in the user's Google Calendar with no prompt. "Remove all synced events" (schedule-sync.service.ts:139) covers only `calendarSyncedEvent` rows, not task events.
- Evidence: code trace.
- Fix: in `deleteSelected`, for tasks with `googleCalendarEventId`, call `unsyncTaskFromCalendar` (after asking, like single delete), or delete the events server-side in the bulk-delete endpoint. Files: useTaskSelection.ts or tasks.service.ts.

#### Suspected

- **a-S1 Logout does not clear the break or countdown state (Low).** `restBreak` is initialised once from the global `pmaxing:focus-break` key (StudySessionProvider.tsx:62) and is not cleared on logout. After logging in as another user in the same browser, the BreakBanner can show "Start next block" with the previous user's `taskId`, and `start` then fails with 404, generic and silent off /focus. Missing: confirm that the provider stays mounted across logout/login (no full reload).
- **a-S2 Task "Add to Google Calendar" fails silently (Medium, documented as deliberate).** `useTasksPage.ts:137-150`, `useQuickReschedule.ts:48-54`, `useTaskSelection.ts:73-78`. A revoked or expired Google token means "Task saved" with no event and no hint. It is documented as deliberate ("falha silenciosa de propósito"), so it is not counted as Confirmed. Recommend at least a warning toast.
- **a-S3 Windows TZID names in .ics (Low).** `parseIcsSchedule.ts:297-307`. A TZID that is not valid IANA (Outlook "W. Europe Standard Time") falls back to floating wall-clock time, shifting classes by the zone difference without an error. Missing: a real export from a portal that uses Windows names.
- **a-S4 Shift overlay hides load errors (Low, documented).** `useWorkShiftRange.ts:16-20` turns a failure into `[]`, so the grid shows no shifts and gives no hint. The comment documents the choice ("não deve partir a grelha").
- **a-S5 "Make weekly" (copy-week `fixed`) keeps the original one-offs (Low).** The source week then has each shift twice (weekly from `startsOn = fromWeekStart`, plus the one-off), and the Google sync creates two events, since the sourceKeys differ. Missing: check whether CopyWeekPanel text tells the user to delete the originals.
- **a-S6 Public feed throttle is per IP (Low).** `calendar-feed.controller.ts:72`, `@Throttle(perMinute(30))`. If the tracker is the IP, Google Calendar fetches for many users arrive from shared Google egress IPs and could get 429, making subscribed calendars silently stale. Missing: check the tracker in LoggingThrottlerGuard (area e/f).
- **a-S7 Timed tasks shown on the previous day in the month view (Low).** `useMonthAgenda.ts:53` uses `task.date.slice(0,10)` (the UTC day). A timed task between 00:00 and 00:59 Lisbon (summer) shows on the previous day; a task at exactly 01:00 summer / 00:00 winter becomes an all-day event in Google and the feed (calendar.service.ts:255-259, calendar-feed.service.ts:174-177). Overlaps area (b)/(f).
- **a-S8 Untranslated error string (Low).** `lib/sessionWindow.ts:28` returns a hard-coded English "A session cannot be longer than 16 hours." instead of an i18n key.

#### Checked and fine
- Stale auto-close is wired on both lazy entry points (start, getActive) and closes at `lastHeartbeatAt`, not "now".
- Heartbeat 404 resyncs the UI (StudySessionProvider.tsx:191).
- Elapsed clock is recomputed from startedAt (no drift in throttled tabs).
- Countdown plan and break persisted per session, with storage failures tolerated (documented).
- focusAlerts.notify now prefers `registration.showNotification` (fixed in the working tree, not re-reported).
- Notification permission is requested inside the Start click (user gesture).
- RateFocusPrompt renders its own error.
- Manual session / edit: frontend and backend apply the same window rules; overlap check present.
- Streak and daily totals use Lisbon days (`toLisbonDateKey`, `lisbonDayBounds`).
- `/study-sessions/active` returns 204, and the client maps the empty body to null.
- Attendance toggle is optimistic, with rollback and an error toast (useSchedule.ts:75-91, WeekGrid.tsx:63).
- .ics import shows imported/failed/removed counts and per-row/parse errors (ImportScheduleModal.tsx:129-150); refetches grid and plan, and triggers the calendar review.
- Import replace (`removeStaleOccurrences`) only touches the file's date range and keeps upserted ids (documented).
- Delete imported classes: toast plus refresh.
- Week dates are UTC-anchored (lib/weekDates.ts), fixing the historic off-by-one.
- Work shifts: createMany is transactional; day-off weekdays are disabled in the UI (ShiftRow.tsx:63, CommitmentSection.tsx:119), so the backend skip at work-shifts.service.ts:126-136 is not hit silently; update validates final values; ownership is checked via `{id, userId}`.
- expandRange respects `startsOn` and days off; the month grid range (42 days) is within MAX_RANGE_DAYS 62.
- Schedule sync: one sync per user (`running` set); per-event failures counted and shown (`result.failed`, CalendarSyncReviewModal.tsx:104); over-limit blocked in the preview (`withinLimit`); deleted calendar recreated; past events are not deleted.
- Remove-all shows `remaining`.
- Calendar feed: token format checked before the DB; revoked tokens are dropped from the cache; private Cache-Control; banned users get 404; travel is computed from the cache only (no Maps cost).
- Travel times: missing GOOGLE_MAPS_API_KEY falls back to stale or default values (documented "nunca lanca").
- Study plan: daily-limit save error rendered; estimate editor error rendered; archived periods excluded.
- CalendarSyncReviewModal is gated by isAuthenticated (no 401 redirect on public pages).
- Schedule view and import options in localStorage are guarded with try/catch.

#### Not covered
- Real-device behaviour (Android/iOS lock screen, iOS `pagehide` on app switch). a-02 to a-04 are proven by code trace and the backend race test, not on a device.
- Frontend component and hook tests: the frontend has no jsdom or testing-library, so provider-level behaviours (a-03, a-06, a-09) are code traces only.
- Google Calendar API behaviour with revoked tokens (no network calls allowed).
- `study-plan.scheduler.ts` (563 lines) was only skimmed: slot packing, overtime and review blocks were not audited line by line. `focus-effect`, `grade-projection` and `prediction` are left to area (b).

### Área b. Tasks, packs, áreas, notas, programas, boletim, previsão

Contagem: Critical 1, High 4, Medium 4, Low 4 (Confirmed). Suspected 6.

#### Confirmed

**B-01. Concluir uma task recorrente pelo overdue check-in termina a série em silêncio**
- Severidade: High
- Onde: backend/src/tasks/tasks.service.ts:654-684 (confirmOverdue) vs :418-420 (update)
- Esperado: "Sim, está feita" no modal cria a próxima ocorrência (e revisões espaçadas), como concluir pelo PATCH normal. Real: confirmOverdue grava COMPLETED e devolve; nunca chama spawnFollowUps. Tasks recorrentes são exatamente as que mais vezes ficam fora de prazo.
- Evidência: backend/src/tasks/tasks.silent-audit.spec.ts, teste "B-01" falha (`task.create` 0 chamadas); o controlo "B-01 control" com update() passa.
- Porque é silencioso: o modal só avança para a próxima pergunta; a série deixa de aparecer sem erro nem log.
- Correção: no ramo isCompleted, se a task não estava COMPLETED, chamar `this.spawnFollowUps(userId, task)` (tasks.service.ts).

**B-02. Arquivar o período ativo deixa-o ativo: tasks novas vão para um período arquivado e desaparecem do plano do dia e do check-in**
- Severidade: High
- Onde: backend/src/academic-programs/periods.service.ts:111-148 (archive não mexe em User.activePeriodId); frontend/src/context/AcademicContext.tsx:98-118 + :58-59 (refresh mantém `activePeriodIdRef`, que é o período arquivado); tasks.service.ts:103-105, 242, 632.
- Esperado: depois de arquivar o semestre em que estou, a app passa para um período ativo, ou pelo menos as tasks que crio continuam a contar. Real: ArchivePeriodButton.tsx:31-32 faz archive + refresh(); load() escolhe `sorted.find(p => p.id === preferredPeriodId)` = o período arquivado. TaskForm, quick add, import e task packs nunca mandam periodId (grep: nenhum `periodId` em components/Tasks ou CommandPalette), por isso o backend usa User.activePeriodId = arquivado. findToday e findPendingOverdueCheckins filtram `period: { isArchived: false }`, logo essas tasks nunca entram no TodayPlan nem no check-in (e study-plan também as exclui).
- Evidência: trace acima, linha a linha.
- Porque é silencioso: a task aparece na lista (que mostra o período ativo), só falta nos sítios que deviam lembrar dela.
- Correção: em archive(), se `user.activePeriodId === id`, mover activePeriod para o período ativo mais recente; no frontend, refresh pós-arquivo não deve preferir um período arquivado. Ficheiros: periods.service.ts, AcademicContext.tsx.
- Irmão: switchPeriod (AcademicContext.tsx:193-197) faz a troca otimista e se activatePeriod falhar só faz console.error; as tasks criadas a seguir vão para o período antigo e `/tasks?open=<id>` do quick add não encontra a task na lista.

**B-03. Mudar o tipo de uma task académica (com subcategoria) para outro tipo falha sempre; limpar só a subcategoria não grava**
- Severidade: High
- Onde: frontend/src/components/Tasks/TaskFormFields.tsx:139-141 (limpa academicType), utils/taskPayload.ts:59 (`'' -> undefined`), backend tasks.service.ts:345-351.
- Esperado: trocar "Académico/Frequência" para "Pessoal", ou mudar a task para uma Area com outro tipo por defeito, grava. Real: o PATCH leva `type` sem `academicType`; o service usa `existing.academicType.key` e resolveTypes lança 400 "Academic subcategory "FREQUENCIA" invalid for type "PESSOAL"". Escolher "sem subcategoria" mantendo o tipo grava com sucesso mas a subcategoria fica.
- Evidência: tasks.silent-audit.spec.ts, teste "B-03" falha com essa BadRequestException.
- Porque é silencioso: o segundo caso é sucesso aparente; o primeiro mostra uma mensagem técnica que não diz ao utilizador o que fazer.
- Correção: enviar `academicType: null` quando vazio no PATCH e, no service, tratar `null` como "limpar" e ignorar a subcategoria antiga quando o tipo muda. Ficheiros: taskPayload.ts, tasks.service.ts, create-task.dto.ts (aceitar null).

**B-04. Apagar uma Area sem tasks apaga em cascata todas as notas do caderno, componentes e entradas de nota**
- Severidade: Critical (perda de dados; num admin a apagar uma Area oficial, afeta todos os utilizadores)
- Onde: backend/src/areas/areas.service.ts:251-263; schema.prisma:1183 (NotebookEntry.area onDelete: Cascade), :1449 (GradeComponent), :1090 (AreaInterest), :1066, :1973.
- Esperado: o aviso diz "uma área com tarefas não pode ser apagada" (i18n hook.areYouSureAnAreaWith), o que sugere que tudo o resto está seguro. Real: só conta tasks; notebookEntry e gradeComponent são apagados pelo cascade sem aviso.
- Evidência: backend/src/areas/areas.silent-audit.spec.ts, teste "B-04" falha (remove resolve e chama area.delete com 12 notas e 3 componentes).
- Porque é silencioso: sucesso normal; o utilizador só nota quando procura as notas.
- Correção: contar notebookEntry/gradeComponent (e, para oficiais, de todos os users) e devolver 409 ou pedir confirmação explícita com os números. Ficheiros: areas.service.ts, i18n do aviso (8 línguas).

**B-05. Limpar um campo no formulário de edição de task não grava (nota real, peso, notas, tópicos, link, estimativa, prioridade)**
- Severidade: High (a nota real errada fica para sempre na média/GPA; o peso fica a ocupar o orçamento de 100%)
- Onde: frontend/src/utils/taskPayload.ts:49-59 (campos vazios -> undefined); backend tasks.service.ts:293-296 (`priority: ''` -> resolvePriorityId devolve undefined -> não mexe) e update() via `...rest`.
- Esperado: apagar "Nota real" e Guardar remove a nota. Real: undefined desaparece no JSON; UpdateTaskDto (PartialType) + Prisma tratam ausente como "não mexer". "Sem prioridade" envia '' e também não limpa. O formulário fecha com sucesso e mostra o valor antigo.
- Evidência: frontend/src/utils/taskPayload.silent-audit.test.ts (8 casos falham: weightPercentage, targetGrade, realGrade, estimatedMinutes, recalledStudyMinutes, notes, topics, referenceLink); backend tasks.silent-audit.spec.ts "B-02" falha (priorityId não é null).
- Porque é silencioso: resposta 200 e UI atualizada com a task devolvida, que ainda tem o valor.
- Correção: no modo edição mandar `null` para campos esvaziados; no backend aceitar null (IsOptional já deixa) e mapear `priority: ''|null` para `priorityId: null`. Irmão: GradeComponentForm.tsx:55 (expectedEntries vazio -> undefined, não limpa).

**B-06. Média com séries recorrentes: cada ocorrência conta o peso inteiro**
- Severidade: Medium
- Onde: backend/src/grade-components/weight-budget.ts:55-71 vs academic-programs/grade-average.util.ts:22-48; tasks.service.ts:532 (spawn copia weightPercentage).
- Esperado: uma série "Quiz semanal 10%" vale 10% da cadeira, como o orçamento de peso assume ("Uma serie recorrente vale o peso UMA vez"). Real: computeWeightedAverage soma cada ocorrência avaliada com peso 10; 10 quizzes = 100 contra um exame de 90, a média da cadeira, o GPA, os créditos e o boletim ficam distorcidos.
- Evidência: trace entre os dois ficheiros; nenhum agrupamento por título em grade-average.util.ts.
- Porque é silencioso: os números aparecem, só estão errados.
- Correção: agrupar ocorrências recorrentes (mesmo título+área+período) numa só entrada com a média das notas, nas queries de periods.service/programs.service (precisa de `recurrenceFrequency`/`title` no select).

**B-07. Ações em massa "Marcar como feitas" e "Apagar" falham sem mensagem (ex.: mais de 200 selecionadas)**
- Severidade: Medium
- Onde: frontend/src/components/Dashboard/BulkActionsBar.tsx:56-79 (try/finally sem catch); useTaskSelection.ts:34-46 (selecionar tudo sem limite); backend DTOs `@ArrayMaxSize(200)` em bulk-update-status.dto.ts:25 e bulk-task-ids.dto.ts:16.
- Esperado: erro visível. Real: a rejeição sobe sem catch (não há listener `unhandledrejection` na app), nada muda, o botão volta ao normal. Com "selecionar tudo" numa tabela de mais de 200 tasks falha sempre. Reschedule (mesmo componente) tem catch e toast.
- Evidência: trace; grep `unhandledrejection` vazio.
- Porque é silencioso: sem toast, sem mudança.
- Correção: catch com notify em handleMarkDone/handleDelete e dividir em lotes de 200 em useTaskSelection/useCompleteWithUndo.

**B-08. Modal de overdue check-in fica bloqueado sem mensagem se a resposta falhar**
- Severidade: Medium (offline/erro de servidor)
- Onde: frontend/src/hooks/useOverdueCheckins.ts:57-60 (só console.error); OverdueCheckinModal.tsx:23 (sem Escape/fundo: "responder é a única saída").
- Esperado: erro e forma de sair. Real: cada clique falha em silêncio e o modal tapa a app. Só sai navegando com o botão Voltar (PageLayout remonta, e como `pmaxing:lastOverdueCheckDate` já é hoje, o resto da fila desaparece até amanhã).
- Evidência: trace.
- Porque é silencioso: botões voltam a ficar ativos sem feedback.
- Correção: guardar um erro no hook, mostrá-lo no modal e permitir "Perguntar mais tarde". Irmãos (Low): a chave de localStorage não é por utilizador (outra conta no mesmo browser no mesmo dia não recebe check-ins) e é gravada antes de responder (F5 com a fila aberta = sem perguntas hoje).

**B-09. "+1 Day"/swipe em Lisboa no horário de verão grava a task como "às 00:00" do dia seguinte (= 23:00 UTC do dia atual)**
- Severidade: Medium (depende do fuso/DST)
- Onde: frontend/src/hooks/useQuickReschedule.ts:30-35 (meia-noite LOCAL `.toISOString()`), em contraste com useTaskSelection.ts:54 (meia-noite UTC, a convenção da app: lib/dateKey.ts:14-24).
- Esperado: a task passa a ser "amanhã, sem hora". Real: `node -e "process.env.TZ='Europe/Lisbon'; const d=new Date(2026,6,15); d.setHours(0,0,0,0); console.log(d.toISOString())"` dá `2026-07-14T23:00:00.000Z`. A task fica com hora (TaskEditForm.tsx:37-40 mostra 00:00), o Google Calendar recebe um evento 00:00-01:00 em vez de dia inteiro, e tudo o que agrupa por `date.slice(0,10)` (lib/monthAgenda.ts:88, useMonthAgenda.ts:53, lib/examMode.ts:22, ExamModePanel.tsx:63) coloca-a HOJE.
- Evidência: comando acima + trace.
- Porque é silencioso: no inverno (UTC+0) funciona; no verão a task parece mudar de dia só em algumas vistas.
- Correção: usar `new Date(toDateKey(addUtcDays(todayUtcAnchored(), 1))).toISOString()` (o mesmo do BulkActionsBar) e preservar a hora se a task tiver hora.

**B-10. Apagar tasks em massa deixa os eventos do Google Calendar órfãos**
- Severidade: Low
- Onde: frontend/src/hooks/useTaskSelection.ts:85-90; backend tasks.service.ts:745-752.
- Esperado: como no apagar individual (useTasksPage.ts:298-315, pergunta se remove o evento). Real: nada é feito ao evento.
- Correção: para as tasks com googleCalendarEventId, chamar unsync (ou perguntar) antes de bulkDeleteTasks.

**B-11. Previsão de duração no formulário de criação ignora a Area escolhida**
- Severidade: Low
- Onde: frontend/src/hooks/useDurationPrediction.ts:42-49 e TaskFormFields.tsx:96-102 (não mandam areaId); backend aceita `areaId` (predict-duration.dto.ts:56-65) e usa-o em prediction.service.ts:180.
- Esperado: a estimativa considera o tempo médio na cadeira. Real: cai sempre na média global. `academicType` é enviado mas o service não o usa.
- Correção: passar `values.areaId` ao hook e ao pedido.

**B-12. Reordenar com filtro ativo grava uma ordem diferente da mostrada**
- Severidade: Low
- Onde: frontend/src/hooks/useTasksPage.ts:457-477 (estado local empurra as não visíveis para o fim) vs backend tasks.service.ts:194-217 (sortOrder 0..k só às visíveis; as escondidas mantêm o sortOrder antigo).
- Esperado: depois de recarregar, a ordem é a que vi. Real: tasks escondidas (filtro/arquivadas) com sortOrder pequeno intercalam-se entre as reordenadas.
- Correção: o backend deve deslocar as não incluídas para depois (ou o frontend mandar a lista completa).

**B-13. Import Excel/CSV: erros do backend apontam para a linha errada da folha**
- Severidade: Low
- Onde: backend tasks.service.ts:868-869 (`rowNumber = i + 1` sobre as linhas JÁ filtradas) vs frontend utils/parseTaskImportFile.ts:113-118 (comentário afirma que é a mesma numeração) e TaskImportModal.tsx:117-121.
- Esperado: "Linha 7: ...". Real: se a linha 2 falhou no parse, a "linha 2" do backend é a linha 3 da folha. As keys React `backend-${r.row}`/`parse-${e.row}` podem colidir.
- Correção: mandar o número da linha da folha em cada row (campo ignorado pelo backend não pode ir: forbidNonWhitelisted; mapear de volta no frontend pelo índice).

#### Suspected

**S-01. Tasks com periodId null nunca entram no plano do dia nem no check-in** (Medium)
- Onde: tasks.service.ts:242 e :632 usam `period: { isArchived: false }`, que exclui null; study-plan.service.ts:158-168 documenta este mesmo bug e usa `OR: [{ periodId: null }, ...]`. Task.periodId é opcional (schema.prisma, model Task).
- Falta: saber se há tasks com periodId null em produção (legado anterior à migração; create/import resolvem sempre um período).

**S-02. Import: datas de células Excel ficam na véspera às 23:00 UTC no verão; datas em texto "10/06/2026" lidas como mês/dia** (Medium)
- Onde: parseTaskImportFile.ts:42 (`cellDates: true`) + :63-71 (`toISOString()`, `new Date(string)`).
- Falta: teste com um .xlsx real em TZ Europe/Lisbon (o vitest corre em node sem fixture); comportamento de SheetJS a confirmar.

**S-03. Exportar CSV e voltar a importar falha em quase todas as linhas académicas** (Low, visível)
- Onde: taskExportFormats.ts:38 escreve a SUBCATEGORIA na coluna "Type" (ou "-"); o import lê "Type" como tipo de task. Erros aparecem por linha, por isso não é silencioso; é drift de contrato.

**S-04. Previsão com estimatedMinutes = 0 fora da distribuição de treino** (Low)
- Onde: prediction.service.ts:182 e :283 passam `estimatedMinutes` null/0 a um modelo treinado com estimativas reais (TRAINING_SELECT). O valor do campo "estimativa" do formulário nunca entra.
- Falta: dados reais para medir o viés.

**S-05. GpaSummary/ProgramsOverviewCard: em erro mantêm os valores antigos** (Low)
- Onde: GpaSummary.tsx:131-133 e ProgramsOverviewCard.tsx:33-35 (só console.error, estado não é limpo). O nome do período vem dos dados, por isso é coerente, mas a média do programa anterior pode aparecer com a escala do programa novo.
- Falta: reproduzir troca de programa com falha de rede.

**S-06. Weekly review inclui períodos arquivados e corta listas em silêncio** (Low)
- Onde: weekly-review.service.ts (overdueCount/upcoming sem filtro de arquivado, ao contrário do check-in; `take: 100/20/30` sem indicação). "No area" não traduzido.

#### Checked and fine
- Posse/IDOR: tasks, subtasks, anexos, task packs, áreas (assertAreaAccessible), componentes de nota, períodos (via program.userId).
- create(): completedAt para tasks criadas já concluídas; sortOrder = max+1.
- update(): completedAt só muda nas transições; postponedCount só quando a data avança; recurrenceUntil null limpa.
- Desligar recorrência no edit: recurrencePayload manda null (lib/recurrence.ts:113-116).
- Bulk status: documentado que não cria ocorrências (useCompleteWithUndo.ts:15-19), não é bug.
- Bulk reschedule: meia-noite UTC correta, postponedCount coerente, resync do Calendar.
- Subtasks: limite, transação, reorder ignora ids alheios, erros com toast.
- Duplicar task: erro com toast.
- Import: limite de 500 no cliente e no servidor, peso por cadeira validado por linha, erros por linha.
- Task pack import: tudo pela TasksService.create, erros por item mostrados.
- Area interests: rollback otimista e erro.
- Arquivar período: bloqueio do último período ativo; restore sem restrições.
- Pin de período: transação, um por programa.
- Componentes de nota: limite de 100% partilhado com tasks, BEST_OF validado, entradas só editam a nota.
- Boletim: ErrorState em erro; print.
- Previsão: fallback MLP -> regressão com log; insufficient_data devolvido honestamente.
- Templates, last-used-area, show-archived: localStorage best-effort com try/catch, documentado.

#### Not covered
- Grade projection / course forecast (backend/src/study-plan/grade-projection.service.ts): pertence ao study-plan (área a).
- Comportamento real de SheetJS com fusos (S-02) e dados de produção (S-01): proibido tocar na BD.
- Testes de hooks React (useQuickReschedule, useOverdueCheckins): o vitest do projeto corre em ambiente node, sem jsdom; ficaram por trace.

### Ficheiros de teste criados
- backend/src/tasks/tasks.silent-audit.spec.ts (B-01, B-02/B-05 prioridade, B-03; 3 falham, 1 controlo passa)
- backend/src/areas/areas.silent-audit.spec.ts (B-04; falha)
- frontend/src/utils/taskPayload.silent-audit.test.ts (B-05; 8 falham)

### Área c. Caderno, pads, social, turmas, partilhas

Counts: Critical 0, High 3, Medium 4, Low 11 (Confirmed). Suspected 5.

#### Confirmed

##### C-01 Co-owner edits are silently overwritten by the owner's open editor (no version check)
- Severity: High (data loss)
- Where: backend/src/notebook/notebook-collab.service.ts:107-112; backend/src/notebook/notebook.service.ts:390-416; frontend/src/hooks/useEntryDraft.ts:24-35; frontend/src/pages/Notebook.tsx:526-541; frontend/src/hooks/useEntryAutosave.ts:52-88
- Expected: a CO_OWNER saves title/notes through /shared/:token and the change stays.
- Actual: `editShared` applies CO_OWNER edits straight to the row. The owner's editor holds a draft that is only re-read from the entry when `entry.id` changes (useEntryDraft effect deps `[entry.id]`), and nothing refetches an open entry. The next owner autosave PATCHes the full payload (`textContent`, `title`, ... from the draft); `update()` writes it with no `updatedAt`/version check. The co-owner's text is replaced by the owner's older copy. The 10 min entry cache (useNotebookEntries.ts:20) widens the window: reopening the entry within 10 min also shows the pre-edit copy. The reverse direction (co-owner form submits full text over newer owner edits) is the same lost update.
- Evidence: code trace above. Only approved proposals are pushed into the draft (NotebookEntryEditor.tsx:59-62, `onProposalApplied`); direct CO_OWNER edits have no equivalent.
- Why silent: both sides show "Saved". Nothing compares versions.
- Fix: add `version`/`updatedAt` optimistic concurrency to PATCH /notebook/entries/:id and to editShared (409 + current, like pads), or at least refetch the entry on focus/push before editing. Files: notebook.service.ts, notebook-collab.service.ts, upsert-notebook-entry.dto.ts, useEntryAutosave.ts. No schema change needed if `NotebookEntry.updatedAt` (exists, `@updatedAt`) is used as the base version; if a `version` column is preferred: `npx prisma migrate dev --name notebook_entry_version`.

##### C-02 Approving a proposal in read mode leaves the old content in the entry cache; the next edit reverts the proposal
- Severity: High (data loss)
- Where: frontend/src/hooks/useEntryShare.ts:276-290; frontend/src/components/Notebook/NotebookEntryEditor.tsx:59-62; frontend/src/hooks/useNotebookEntries.ts:93-101, 117-124
- Expected: after "Approve", the entry shows the proposed text from now on.
- Actual: `decideProposal` only calls `onProposalApplied`, which patches the editor draft. `useNotebookEntries`' cache and `loadedEntry` keep the pre-proposal entry. Typical path: push "suggestion received" opens `/notebook?entry=..&share=1` in read mode, owner approves (draft updated, autosave disabled because not editing, so nothing re-saves). Owner opens another entry and comes back within 10 min: `openById` serves the cached pre-proposal entry; the editor shows the old text. If the owner then edits, autosave sends the old text plus the edit and silently undoes the approved proposal on the server.
- Evidence: code trace; `cachedEntry()` returns hits < ENTRY_CACHE_MS without revalidation; nothing calls `replaceEntry`/`remember` after `decideChangeProposal`.
- Why silent: the server is correct until the next save; the UI shows "Saved".
- Fix: after approval, refetch the entry (`getNotebookEntry`) and `replaceEntry` it, or drop it from the cache. Files: useEntryShare.ts (return the updated entry or expose a callback), NotebookEntryEditor.tsx / Notebook.tsx.

##### C-03 Ctrl+K notebook result does nothing when already on /notebook, and a stale snapshot opens later
- Severity: High (core action silently fails; can lead to data loss)
- Where: frontend/src/components/CommandPalette/CommandPalette.tsx:487-488; frontend/src/pages/Notebook.tsx:290-294; frontend/src/lib/pendingNotebookEntry.ts
- Expected: picking a notebook result in the palette opens that entry.
- Actual: the palette stores the full entry in sessionStorage and calls `navigate('/notebook')`. `Notebook` consumes it only in a mount effect (`[]`). When the user is already on /notebook, the route element is not remounted, so nothing happens and the palette closes. The snapshot stays in sessionStorage. The next time Notebook mounts in that tab (maybe much later), it opens this old snapshot via `selectEntry(full entry)`, which `remember()`s it as fresh. If the entry was edited in between, the editor shows the old text and the next edit autosaves the old text over the newer one.
- Evidence: code trace; Notebook already supports a reactive `?entry=<id>` param (Notebook.tsx:302-322) that would work on the same route.
- Why silent: no error, palette just closes.
- Fix: navigate to `notebookEntryPath(item.entry.id)` (the `?entry=` deep link) and remove the sessionStorage hand-off. Files: CommandPalette.tsx, Notebook.tsx, lib/pendingNotebookEntry.ts.

##### C-04 Photo/attachment upload or delete writes a stale entry back into state/cache
- Severity: Medium
- Where: frontend/src/pages/Notebook.tsx:545-572; frontend/src/hooks/useFileUpload.ts:17-33; frontend/src/hooks/useNotebookEntries.ts:155-163
- Expected: uploading a photo while still typing keeps both the photo and the text.
- Actual: `onUploadPhoto` closes over `selectedEntry` from the render where the upload started and calls `replaceEntry({...selectedEntry, photos: [...]})` when it finishes. If an autosave completed meanwhile (user kept typing during a slow mobile upload), the cache and `loadedEntry` are replaced by the pre-autosave text. Reopening the entry within 10 min shows the old text, and the next edit saves it over the server copy. Second effect: two uploads started before the first finishes each append to the same stale `photos` array, so the first photo vanishes from the UI (it exists on the server), inviting a duplicate upload. Same pattern for attachments and both deletes.
- Evidence: code trace (closure captured by `useFileUpload.handleChange` at change time).
- Why silent: the editor draft is unaffected while it stays open, so the user sees nothing until reopening.
- Fix: make `replaceEntry` take an updater (`prev => ({...prev, photos: [...prev.photos, photo]})`) applied to the latest cached/loaded entry. Files: useNotebookEntries.ts, Notebook.tsx.

##### C-05 New entries get the UTC day, then the wrong day is persisted on the first save
- Severity: Medium (depends on time zone / time of day)
- Where: frontend/src/pages/Notebook.tsx:226 (`date: new Date().toISOString()`); frontend/src/components/Notebook/entry/notebookEntryConfig.ts:40-42 (`iso.slice(0, 10)`); frontend/src/components/Notebook/NotebookEntryEditor.tsx:132-146
- Expected: a note written at 22:30 in Sao Paulo or 08:00 in Tokyo is dated today.
- Actual: the editor reads the UTC day of the creation instant (next day in UTC-3 evenings, previous day in UTC+9 mornings, previous day in Lisbon between 00:00 and 01:00 in summer). The list shows the local day, but the first autosave sends `${utcDay}T12:00:00` local, which moves the entry to the wrong day. In UTC+13 (NZ summer) local noon is the previous UTC day, so every save moves the date one more day back. Backend search formats dates in server UTC (notebook.service.ts:1250), a smaller variant of the same issue.
- Evidence: failing test `frontend/src/components/Notebook/entry/notebookEntryDate.silent-audit.test.ts` (both cases fail: returns 2026-10-25 and 2026-10-23).
- Why silent: the date field just shows a plausible date; the shift happens on a save triggered by an unrelated edit.
- Fix: derive the input value with local getters (`getFullYear/getMonth/getDate` on `new Date(iso)`), and create entries with local noon. Files: notebookEntryConfig.ts, Notebook.tsx.

##### C-06 Leaving an entry with unsaved edits loses them if the leave-time save fails
- Severity: Medium (data loss on flaky network; main save path when autosave is off)
- Where: frontend/src/hooks/useEntryAutosave.ts:106 (`useEffect(() => () => void flushRef.current(), [])`), :70-86
- Expected: "on leaving the entry" the pending text is saved (the comment at :14-16 promises this as the safety net when autosave is off).
- Actual: the editor is keyed by entry id (Notebook.tsx:522), so switching entries or routes unmounts it and the cleanup fires `flush()` without awaiting. If the PATCH fails (offline, 403 CSRF, 5xx), `setError/setStatus` run on an unmounted component and the draft is discarded. No toast, no retry, no local draft.
- Evidence: code trace.
- Why silent: the error UI lived in the unmounted toolbar.
- Fix: keep the last unsaved payload (sessionStorage per entry id) and offer restore, or block switching until the flush resolves and show a global toast on failure. Files: useEntryAutosave.ts, NotebookEntryEditor.tsx.

##### C-07 Notes-access subject picker gets stuck when a granted subject no longer qualifies
- Severity: Medium
- Where: frontend/src/components/Social/NotesAccessPanel.tsx:33-66, 131-138; backend/src/notebook/notebook-view-grant.service.ts:107-125, 170-181
- Expected: owner opens "change subjects" on an approved grant, edits, saves.
- Actual: `AreaPicker` starts with `initial = g.areaIds` but only renders checkboxes for `view.areas`, which `ownerAreas()` builds from areas that still have at least one non-private entry. If the owner made every note of a granted subject private (or deleted them), that id stays checked but invisible, cannot be unchecked, and `validateAreas` rejects it with 400. `onSubmit` returns false, the picker stays open, no message. Same for approve when a request arrives and the grant flow sends such ids.
- Evidence: code trace (`areaIds.some((id) => !allowed.has(id))` throws; `run()` in useNotesAccess.ts swallows it).
- Why silent: no error rendering in the panel.
- Fix: filter `initial` to `view.areas` ids, and show the action error. Files: NotesAccessPanel.tsx, useNotesAccess.ts.

##### C-08 Deleting an entry never logs a failed Storage cleanup
- Severity: Low
- Where: backend/src/notebook/notebook.service.ts:425-447
- Expected: best-effort cleanup that at least logs failures (as the comment says).
- Actual: `.remove(paths).catch(...)`: storage-js 2.x resolves `{ data: null, error }` on failure (node_modules/@supabase/storage-js/dist/index.cjs:471-486 `handleOperation`), never rejects, so the catch never runs. Orphan files accumulate with no log line.
- Evidence: failing test `backend/src/notebook/notebook.service.silent-audit.spec.ts` (expects a warn/error log, gets 0 calls).
- Why silent: error object is discarded.
- Fix: `.then(({ error }) => error && this.logger.warn(...))`. File: notebook.service.ts.

##### C-09 Notebook delete actions fail without a message
- Severity: Low
- Where: frontend/src/hooks/useConfirmDelete.ts:9-17 (modal closes in `finally`, rejection escapes `void deletion.confirm()` at NotebookEntryEditor.tsx:305); components/Notebook/entry/EntryFilesSection.tsx:98 and :142 (`() => void onDelete(id)`); components/Notebook/NotebookScheduleLink.tsx:55-60 (`handleRemove` has no catch)
- Expected: a failed delete says so.
- Actual: unhandled promise rejection, the modal closes, the item simply stays.
- Why silent: no catch / no error state.
- Fix: catch and show an error (reuse the section `error` from useFileUpload, add one to the delete modal). Files above.

##### C-10 Social actions fail without feedback
- Severity: Low
- Where: frontend/src/hooks/useSocial.ts:51-63 (`run` returns false) used by SocialLists.tsx:56, 95, 100, 111, 144; hooks/useNotesAccess.ts:19-27 (load error swallowed) and :34-45; pages/FriendProfile.tsx:110-117 (`askNotes` try/finally, no catch)
- Expected: accept/decline/remove/block/unblock/request notes show an error when they fail; Requests tab reflects pending notes requests.
- Actual: the `false` result is ignored everywhere (confirm dialog closes anyway). If the first `useNotesAccess` load fails, the Requests tab shows "nothing waiting" while notes requests are pending (Social.tsx:40, 121).
- Why silent: no error state wired.
- Fix: surface a toast/inline error when `run` returns false; add `hasError` to useNotesAccess. Files: useSocial.ts, useNotesAccess.ts, SocialLists.tsx, NotesAccessPanel.tsx, FriendProfile.tsx.

##### C-11 Clearing the class number (or switching CLASS to NOTE) is never saved
- Severity: Low
- Where: frontend/src/components/Notebook/NotebookEntryEditor.tsx:129, 136; backend/src/notebook/notebook.service.ts:398
- Expected: empty class number field saves as "no number".
- Actual: the payload sends `classNumber: undefined` (dropped by JSON), and `update()` passes `undefined` to Prisma, which leaves the old value. Status says "Saved"; reopening shows the old number again (and a NOTE keeps a stale classNumber that feeds `nextClassNumber` only for CLASS entries).
- Fix: send `null` when cleared or when type is not CLASS (DTO already accepts it via @IsOptional). File: NotebookEntryEditor.tsx.

##### C-12 Requests/proposals get stuck after switching a share to Public
- Severity: Low
- Where: backend/src/notebook/notebook.service.ts:503-526 (visibility change keeps requests/proposals); backend/src/notebook/notebook-social-hub.service.ts:265-275; frontend/src/hooks/useEntryShare.ts:150, 173, 205; pages/Notebook.tsx:142-151
- Expected: the waiting badge matches what the share panel lets you act on.
- Actual: `myShares` still counts PENDING requests and proposals on a PUBLIC share, so the Notebook list and the Social "mine" tab show "waiting N", but the share panel only loads requests/proposals when `visibility === 'AUTHORIZED'`, and an EDITOR becomes VIEWER on a public link, so the proposal can never be decided there. Badge never clears unless the owner switches back.
- Fix: load requests/proposals regardless of visibility, or exclude them from counts when PUBLIC. Files: useEntryShare.ts or notebook-social-hub.service.ts.

##### C-13 Pad / turma note: the last keystrokes are lost on navigation
- Severity: Low
- Where: frontend/src/hooks/useVersionedDoc.ts:73-76, 105-111
- Expected: text typed just before leaving is saved.
- Actual: unmount (or slug change) clears the 800 ms timer without a flush, and there is no `beforeunload` guard. A failed save ("Keep typing to try again") is also dropped when the user leaves.
- Fix: flush on unmount/pagehide when status is dirty/error and add a beforeunload guard. File: useVersionedDoc.ts.

##### C-14 Social pushes show an empty name
- Severity: Low
- Where: backend/src/social/social.service.ts:253-260; backend/src/notebook/notebook-view-grant.service.ts:94-103, 193-202
- Expected: "Ana sent you a friend request."
- Actual: `name: me?.name ?? ''` while `User.name` is optional (schema.prisma:218); push body becomes " sent you a friend request." The notebook pushes fall back to the email prefix; these three do not.
- Fix: same fallback as notebook.service.ts:596. Files above.

##### C-15 "Public link" error shown for every 409 when inviting from a friend's page
- Severity: Low
- Where: frontend/src/components/Social/ShareNoteWithFriend.tsx:77-83; backend/src/notebook/notebook-invite.service.ts:59-62, 86-89, 124-128
- Expected: "they declined recently" / "note is full" when that is the cause.
- Actual: all three 409s show `friend.share.publicLink` plus a link to switch visibility, which does not help.
- Fix: send a `code` in the 409 body and map it. Files above.

##### C-16 Signed photo/attachment URLs expire on a long-open entry
- Severity: Low
- Where: backend/src/notebook/notebook.service.ts:45 (1 h TTL); frontend/src/hooks/useNotebookEntries.ts (open entry never revalidated); pages/SharedNotebookEntry.tsx (no refresh once ok)
- Expected: attachment links keep working during a 90 min class.
- Actual: after 1 h, attachment clicks open a Supabase "expired" error and newly rendered images break; nothing refreshes the URLs while the entry stays open.
- Fix: refetch the entry on focus after ~50 min, or on image/attachment error. Files: useNotebookEntries.ts, SharedNotebookEntry.tsx.

##### C-17 Hidden caps on social/sharing lists
- Severity: Low
- Where: notebook-social-hub.service.ts:221 (`myShares` take 100, feeds Notebook share badges and "mine" tab); notebook-shared-with-me.service.ts:58/78 (100); notebook-view-grant.service.ts:285 (friend notes 300), :134/:236 (200); turma-linked-areas.service.ts:97 (200)
- Actual: older items silently missing (e.g. share badge/pending count absent for the 101st shared note), no "more" indicator.
- Fix: paginate or show "showing first N". Files above.

##### C-18 Pad locked by someone else while you type: misleading "keep typing" state
- Severity: Low
- Where: frontend/src/hooks/useVersionedDoc.ts:86-101; hooks/usePad.ts:31-37; components/Pad/PadEditor.tsx:35; backend/src/pads/pads.service.ts:117-121
- Expected: the editor turns read-only and says the pad is locked.
- Actual: save returns 403; `meta` is not refreshed on errors and polling stops in `error`, so the textarea stays editable and says "Could not save. Keep typing to try again"; every retry 403s. Same for a turma note after the delegado turns off `membersCanEditNotes` (TurmaNote.tsx:24).
- Fix: on 403 reload the doc/meta (or parse it from the body). Files: useVersionedDoc.ts, usePad.ts.

#### Suspected

- S-01 (Medium) Pending autosave lost when a mobile PWA is backgrounded and killed: useEntryAutosave flushes only on timer/unmount; no `visibilitychange`/`pagehide` flush, and `beforeunload` is not honoured on iOS. Missing: device test.
- S-02 (Low) Re-adding an ex-friend silently restores the old APPROVED notes grant and invited shares (grants/requests are not cleared on unfriend; access checks only re-test friendship). May be intended; check with the user.
- S-03 (Low) Shared-with-me shows an invited-and-accepted note (title visible, status APPROVED) after the friendship ends, but opening it returns `denied` (share-role.util.ts:55-59 vs notebook-shared-with-me.service.ts:87-101). Missing: confirm UI wording on the denied gate.
- S-04 (Low) `trust proxy` = 1 (main.ts:81): if Render sits behind more than one proxy hop, all anonymous pad writers share one IP hash (blocking one source blocks everyone; per-IP throttle shared). Area (e)/(f) to confirm hop count.
- S-05 (Low) Approving a proposal replaces the whole text with the snapshot taken when it was proposed, discarding owner edits made after it (notebook-collab.service.ts:244-252). The panel receives `currentText`, so a diff may make this visible; not verified that the diff is shown against the current text.

#### Checked and fine
- Ownership checks on every notebook entry/photo/attachment/share route (findOwnedEntryOrThrow, IDOR-safe request/proposal lookups).
- Upload validation by magic bytes; frontend limits match backend (8 MB photos, 20 MB / 10 files attachments, extension list).
- Useful link validation in the frontend mirrors @IsUrl (toLinkUrl), so autosave cannot be poisoned by a bad link.
- forbidNonWhitelisted DTO: the Notebook save payload fields all exist in UpdateNotebookEntryDto (incl. privateFromFriends).
- Text > 50000 blocks autosave with a visible error (describeSaveError).
- detectClassNow is GET-only and never writes (documented); auto link is a POST, failure tolerated by design.
- Share visibility switch keeps token; revoke cascades requests.
- Invite requires AUTHORIZED; UI only shows invite when AUTHORIZED; friendship re-checked on access and on accept.
- Pads: optimistic save + 409 conflict banner; anonymous 20k limit enforced both sides; lock/unlock; slug lowercased both sides.
- Pad expiry job wired into RemindersService.run with error logging; locked pads excluded (documented).
- Turma notes: optimistic concurrency like pads; member removal deletes their linked subjects; turma delete removes Storage files first.
- Turma announcements push to all members (fire-and-forget, documented).
- Account deletion removes notebook files and throws on Storage error before the irreversible step.
- Social: friend code input trimmed and pattern-validated; blocked/banned look like "not found"; mutual request auto-accepts.
- Live refresh hooks pause when hidden and react to push messages.
- Clipboard failures are intentionally silent with the value still visible.

#### Not covered
- No runtime/browser testing (rules forbid starting servers). Frontend has no React test renderer installed (no @testing-library/jsdom), so hook races (C-01..C-04, C-06) are proven by code trace, not by tests.
- PushService internals (delivery, preferences, 404/410 cleanup) left to area (d).

### Área d. Bem-estar, medicação, lembretes, push, mail, notificações

#### Confirmed

**D-01. Medication doses between 23:46 and 23:59 are never reminded**
- Severity: Critical (medication)
- Where: `backend/src/wellbeing/medications.service.ts:77-103` (findDueDoses), `:271-287` (sendDueReminders uses `getLisbonNow()` today/nowMinutes)
- Expected: a push for every daily dose. Actual: the cron runs at :00/:15/:30/:45. At 23:45 a 23:50 dose has `late = -5` (not due). At 00:00 `today` is the next day and `nowMinutes = 0`, so `late = 0 - 1430` (negative). The dose is never due. Doses from 23:00 to 23:45 also lose part of their 60 min window at midnight; GitHub cron delays make even 23:30 doses fragile.
- Evidence: test `D-01: a dose at 23:50 is reminded by some cron run around midnight` fails (0 calls across runs 23:45, 00:00, 00:15, 00:30, 00:45). Control test passes.
- Why silent: no error, no log line; the form accepts any time 00:00-23:59 and shows the bell icon.
- Fix: compute due doses against "now minus window" across the day boundary (check yesterday's slots with `nowMinutes + 1440`, using yesterday's date for the dose row). Files: `medications.service.ts`, spec.

**D-02. Unticking a dose before its time cancels its reminder**
- Severity: Critical (medication)
- Where: `medications.service.ts:247-264` (setDose upsert creates a row with `takenAt: null`), `:285` (`doses: { where: { date: today } }`, no filter), `:87` (`handled` = any row)
- Expected: tick by mistake, untick, still get the 08:00 reminder. Actual: the untick leaves a MedicationDose row with `takenAt = null, remindedAt = null`; findDueDoses treats any row as "reminded or taken", so no push is sent.
- Evidence: test `D-02: unticking a dose before its time does not cancel its reminder` fails (0 calls at 08:05).
- Why silent: checklist shows the dose as not taken, bell icon still on; nothing says the reminder was cancelled.
- Fix: in sendDueReminders filter `doses: { where: { date: today, OR: [{ takenAt: { not: null } }, { remindedAt: { not: null } }] } }`. Files: `medications.service.ts`, spec.

**D-03. A repeated push with the same tag replaces the old one with no sound or vibration**
- Severity: Critical (medication; also affects deadlines and social pushes)
- Where: `frontend/public/push-sw.js:12-22` (`tag` set, no `renotify`), `backend/src/push/push.service.ts:215` (`tag: key`, e.g. `medicationDue`)
- Expected: the 20:00 medication reminder alerts like the 08:00 one. Actual: if the 08:00 notification is still in the tray, the 20:00 one has the same tag and replaces it silently (Notifications API: `renotify` defaults to false, so a replacement does not alert). Same for `deadlineSoon`, `friendRequest`, etc.
- Evidence: test `D-03: a tagged push re-alerts when it replaces an older one` fails (`renotify` is undefined).
- Why silent: the notification does appear, but without sound/vibration; the user is not alerted.
- Fix: set `renotify: true` whenever `tag` is set in `push-sw.js` (or make the tag unique per dose/day for medication). Files: `frontend/public/push-sw.js`.

**D-05. Wellbeing "today" is the UTC date and frozen at mount; backend uses the Lisbon day**
- Severity: Critical (medication checklist; mood data overwrite)
- Where: `frontend/src/hooks/useMedications.ts:32` and `hooks/useMoodToday.ts:8` (`useState(todayKey)`), `frontend/src/lib/dateKey.ts:10` (UTC). Backend: `medications.service.ts:201,272` and `wellbeing-insights.service.ts:50` use `getLisbonNow().today`.
- Expected: the checklist and mood card show and write the current Lisbon day. Actual: (a) in summer, from 00:00 to 00:59 Lisbon the frontend uses yesterday: ticking a 00:30 dose flips yesterday's slot (it may UNTICK it if yesterday was ticked), today's slot stays empty, and the cron then reminds a dose that was taken. Saving mood overwrites yesterday's log (PUT is an upsert; the card pre-fills yesterday's values). (b) `today` never changes while mounted: an installed PWA resumed on `/wellbeing` the next morning shows yesterday's ticks as today's doses, so a user can believe today's doses are already taken, and new ticks are written to yesterday.
- Evidence: test `D-05: the day key used by the wellbeing hooks matches the Lisbon day` fails (`2026-07-15` vs `2026-07-16`). (b) by trace: no effect re-reads the date on visibility/focus/midnight.
- Why silent: the card has no date label; ticks succeed (200) and the toast says saved.
- Fix: use a Lisbon day-key helper (same as backend `toLisbonDateKey`) and recompute it on `visibilitychange`/focus, reloading when it changes; show the date on the checklist. Files: `lib/dateKey.ts` (new helper), `hooks/useMedications.ts`, `hooks/useMoodToday.ts`.

**D-06. Push subscription survives logout and is shared across accounts; UI says "on" for the wrong account**
- Severity: High (privacy on shared devices; medication reminders lost)
- Where: `frontend/src/context/AuthContext.tsx:74-84` (logout never unsubscribes), `backend/src/auth/auth.controller.ts:239` (logout does not delete PushSubscription), `backend/src/push/push.service.ts:90-114` (same endpoint moves to the current user), `frontend/src/hooks/usePushNotifications.ts:55-57` (state `on` = the browser has any subscription)
- Expected: after logout the device stops getting my notifications; a second account on the device sees its true state. Actual: user A enables push, logs out: A's deadline titles, friend names and turma announcements keep arriving on that device. User B logs in: the card says "Notifications are on for this device" and the entry prompt never shows (`NOTHING_TO_ASK` includes `on`), but the backend row still belongs to A, so B (including B's medication reminders) gets nothing. If B presses Enable elsewhere, the row moves to B and A silently loses the device.
- Evidence: code trace above (no unsubscribe on logout in either side; refresh() never asks the backend).
- Why silent: the UI shows "on"; only the Test button (devices = 0) would reveal it.
- Fix: on logout call `unsubscribePush(endpoint)` and `subscription.unsubscribe()` (best effort) before clearing state; on login/app start re-POST the existing subscription to `/push/subscribe` so the row follows the current account. Files: `context/AuthContext.tsx`, `hooks/usePushNotifications.ts`.

**D-07. No `pushsubscriptionchange` handler and no re-sync: a rotated or cleaned subscription stops reminders forever while the UI says "on"**
- Severity: High (medication reminders depend on it)
- Where: `frontend/public/push-sw.js` (only `push` and `notificationclick`), `hooks/usePushNotifications.ts:49-61` (refresh never sends the existing subscription), `push.service.ts:229-233` (404/410 deletes the row)
- Expected: notifications keep working. Actual: when the browser rotates the subscription (Firefox fires `pushsubscriptionchange`; Chrome on key/endpoint change) the new endpoint is never sent; the old one returns 410 and is deleted. Also any server-side delete (410 after a transient issue, account switch D-06) is never repaired because the app never re-posts. The browser still has a subscription, so the card shows "on".
- Evidence: code trace (handler absent; refresh only reads browser state).
- Why silent: backend logs nothing for 404/410 (deletes quietly); UI shows "on".
- Fix: add a `pushsubscriptionchange` handler that resubscribes and POSTs to `/push/subscribe` (needs the public key and credentials; simplest is to flag it and let the app re-sync), and in refresh() re-POST an existing subscription when state is `on`. Files: `public/push-sw.js`, `hooks/usePushNotifications.ts`.

**D-08. Medication reminders silently need push on some device; the Wellbeing card never says so**
- Severity: High (medication prerequisite)
- Where: `components/Wellbeing/MedicationsCard.tsx:408-410` (bell icon from `remindersEnabled` only), `MedicationForm.tsx:124-132`, backend `medications.service.ts:307-308` (`delivered === 0` -> skip, retried only within the 60 min window, then dropped)
- Expected: turning on reminders means I get them, or I am told why not. Actual: with push off/blocked/unsupported/unconfigured (no VAPID) or 0 devices, nothing is ever delivered and nothing is shown on the card; the only hint is a help line "on devices with notifications turned on".
- Evidence: code trace; MedicationsCard does not use `usePushNotifications`, and no API exposes "user has 0 devices".
- Why silent: bell icon shows reminders as active; backend only logs "o utilizador nao tem dispositivos registados" at info level.
- Fix: in MedicationsCard/Form read `usePushNotifications().state` and show a warning with an Enable button when any daily med has reminders and state is not `on`; optionally expose device count. Files: `MedicationsCard.tsx`, `MedicationForm.tsx`, i18n x8.

**D-09. A medication push can arrive up to 24 h late and looks current**
- Severity: High (risk of a mistimed dose; body text mitigates)
- Where: `push.service.ts:224` (`TTL: 60 * 60 * 24`, `urgency: 'high'` for all keys), `public/push-sw.js:21` (`timestamp: Date.now()` = display time)
- Expected: a stale reminder is dropped or clearly dated. Actual: a phone offline at 08:00 gets the 08:00 "Time for a dose you planned" when it reconnects (up to 24 h later), stamped with the display time.
- Evidence: code trace.
- Why silent: the notification looks like a fresh reminder.
- Fix: per-key TTL (e.g. 60 min for medication) and send `sentAt` in the payload so the SW uses it as `timestamp`. Files: `push.service.ts`, `push-sw.js`.

**D-04. Focus alerts (uncommitted fix): same tag + requireInteraction without renotify, so the second alert is silent**
- Severity: High (Focus core alert; sibling of the known bug)
- Where: `frontend/src/lib/focusAlerts.ts:40-47`
- Expected: block-end and break-end both alert. Actual: `requireInteraction: true` keeps the block-end notification in the tray; the break-end one uses the same `pmaxing-focus` tag, replaces it and does not alert (no `renotify`).
- Evidence: test `D-04: Focus alerts re-alert when they replace the previous one` fails.
- Why silent: the notification appears without sound/vibration.
- Fix: add `renotify: true` to the options in `notify()`. Files: `lib/focusAlerts.ts`.

**D-10. Medication times and quiet hours are Lisbon wall clock, but the UI does not say so**
- Severity: Medium (environment: users outside Europe/Lisbon, including the Azores at UTC-1; medication impact)
- Where: `MedicationForm.tsx:94-99` (plain `type="time"`), `formatClock` display, backend `medications.service.ts:272`, `reminders.service.ts:145,270-280`, DTO description `medication.dto.ts:46`
- Expected: "08:00" means 08:00 where I am. Actual: stored and fired as 08:00 Lisbon; an Azores user is reminded at 07:00 local, a Brazil user 3-4 h early. The Lisbon convention is documented in code, but never shown to the user.
- Evidence: code trace.
- Why silent: the time shown matches what was typed.
- Fix: show "(Lisbon time)" next to the inputs when the browser zone differs, or store a user time zone. Files: `MedicationForm.tsx`, `CommuteSettingsCard.tsx`, i18n x8.

**D-11. Push language frozen at subscribe time**
- Severity: Low
- Where: `push.service.ts:106,112`; `usePushNotifications.ts:89` (only on enable)
- Expected: notifications follow the app language. Actual: changing language later keeps the old `lang` on the subscription.
- Fix: re-POST subscribe when `lang` changes and state is `on`. Files: `usePushNotifications.ts`.

**D-12. All emails are English only; deadline email `dueLabel` is English**
- Severity: Low
- Where: `mail/mail.service.ts:110-128,184-222`, `reminders.service.ts:254-268`
- Fix: pass the user's language and localise templates. Files: `mail.service.ts`, `reminders.service.ts`.

#### Suspected

**D-13. Cron retry can overlap a slow run and send duplicate reminders** (Medium)
- Where: workflow `curl --max-time 90 --retry 3 --retry-all-errors`; `reminders.service.ts:111` and `medications.service.ts:271` have no lock; SentReminder/dose rows are written after sending.
- Why: if a run exceeds 90 s (cold start plus sequential SMTP with 30 s socket timeout), curl retries while the first request is still processing; both read "not sent" and both send. Throttle (5/min) does not stop 2 overlapping calls.
- Missing: Render timing logs for real run duration.

**D-14. Focus alerts do not fire while the tab/PWA is in the background on mobile** (Medium, overlaps area a)
- Where: `TimerEndPrompt.tsx:22-26`, `BreakBanner.tsx:18-31` (driven by in-page timers); comment `focusAlerts.ts:1-2` claims it works in the background.
- Why: Android/iOS freeze background pages, desktop Chrome throttles hidden timers to once per minute; the alert only fires when the user returns.
- Missing: device test. A real fix needs a scheduled server push or similar.

**D-15. iPhone in Safari (not installed) is told "This browser does not support push"** (Medium)
- Where: `usePushNotifications.ts:16-20`, i18n `push.unsupported`.
- Why: iOS exposes PushManager only in Home Screen apps; the message does not tell the user to install, so medication reminders on iPhone never work.
- Missing: device verification.

**D-16. VAPID key rotation leaves dead subscriptions marked "on"** (Low): old subscriptions get 403 (not 404/410), logged and kept; `enable()` reuses the old subscription (`usePushNotifications.ts:83-88`). Missing: rotation test.

**D-17. Email reminders ON with SMTP missing are retried every 15 min forever, user not told** (Low): `reminders.service.ts:200` continues; `mail.service.ts:44-49` logs error every run. Missing: whether prod SMTP is configured.

**D-18. Chime AudioContext created outside a gesture is suspended on iOS/Safari** (Low): `focusAlerts.ts:79`, no `resume()`. Missing: device test.

**D-19. Scheduled workflow can be disabled or delayed by GitHub** (Low): public repos with 60 days of no activity get schedules disabled; delays shrink the 60 min dose window (worsens D-01). Missing: repo visibility.

**D-20. notificationclick on an uncontrolled window focuses but does not navigate** (Low): `push-sw.js:37-40` calls `client.navigate()` (rejects for clients this SW does not control, matched via `includeUncontrolled: true`) without awaiting. Missing: browser test.

**D-21. Deadline reminder edge cases** (Low): `take: 1000` (`reminders.service.ts:142`) counts tasks already reminded; in winter a timed task at exactly 00:00 Lisbon (= 00:00 UTC) is treated as date-only (`:236-242`). Missing: production volume; how area b stores timed midnight tasks.

#### Checked and fine
- Cron endpoint auth: 404 without CRON_SECRET, timing-safe compare, throttled, CSRF skipped (`reminders.controller.ts:40-45`).
- Workflow present on origin/main; fails loudly on missing secret or non-2xx.
- Deadline reminders idempotent per task date (SentReminder, `skipDuplicates`), only marked when a channel delivered.
- Medication failure isolated from deadline reminders and pads cleanup (try/catch with warn).
- Medication push text has no medication name on the lock screen (`medications.service.ts:298-306`).
- Banned users excluded from both reminder jobs.
- Push 404/410 subscriptions deleted (`push.service.ts:229-233`); other errors logged.
- VAPID missing: push disabled with warn, `public-key` null, UI shows "not configured", test endpoint returns `configured: false`.
- SSRF guard on push endpoints (`isAllowedPushEndpoint`), max 10 devices.
- Push payload URL restricted to app paths in server and SW.
- `getActiveRegistration` timeout avoids a stuck button in dev; error shown.
- Permission request only from a click; blocked state explains how to unblock.
- Push entry prompt marked answered on any response; private mode does not nag.
- Mail: HTML escaped in deadline email; timeouts set; never throws.
- Medication ownership: all queries scoped by userId; ParseUUIDPipe on ids.
- Disclaimer enforced on create medication and create intake; version bump forces re-accept.
- Switching AS_NEEDED to DAILY: reminder toggle visibly off in form (not silent).
- Toggle dose: optimistic update rolled back with toast on failure.
- Mood upsert scoped by user; range capped at 366 days.
- PushSubscription and MedicationDose cascade on user delete; intakes included in data export.
- Migrations for the uncommitted schema changes exist (untracked `20261024*_medication_*`).

#### Not covered
- No device or browser runs (forbidden to start servers): D-14, D-15, D-18, D-20 need real devices.
- Did not read every non-medication push trigger in areas c/e beyond confirming they use notifyUser (D-03 applies to them).
- Overdue task check-ins (`useOverdueCheckins`) belong to area b.

### Área e. Auth, perfil, definições, admin, segurança, telemetria, agente Go

#### Confirmed

**E-01 Email case: mixed-case login fails with 500; OAuth with different case creates a second account** - High
- Where: backend/src/auth/services/password-auth.service.ts:219 (`findUnique({ where: { email } })`), :264 create; oauth-identity.service.ts:106 and :125; no lowercasing in login.dto.ts / register.dto.ts / Login.tsx / Register.tsx; schema `email String @unique` (case-sensitive).
- Expected: one account per email regardless of case (Supabase Auth treats email case-insensitively).
- Actual: registered as "Rodrigo@Example.test" (phone keyboards capitalise), login as "rodrigo@example.test": Supabase accepts, local lookup misses, create() collides on unique supabaseAuthId (P2002, unhandled) -> 500 -> Login shows "Invalid credentials or server error." OAuth with the lowercase email (Google/GitHub verified) also misses the row and creates a brand-new empty account (email unique is case-sensitive, so create succeeds).
- Evidence: test `backend/src/auth/services/password-auth.email-case.silent-audit.spec.ts` FAILS with "Unique constraint failed" from syncLocalUser.
- Why silent: error message suggests wrong password; duplicate OAuth account looks like a normal login with empty data.
- Fix: normalise email (`trim().toLowerCase()`) in DTOs (class-transformer @Transform) and in OAuth strategies, and use `mode: 'insensitive'` lookups in syncLocalUser/resolveIdentity; one-off data check for existing mixed-case rows. Files: auth/dto/*.ts, strategies/*.ts, password-auth.service.ts, oauth-identity.service.ts.

**E-02 Password reset (forgot password) does not revoke existing sessions** - High (security-adjacent)
- Where: frontend/src/pages/ResetPassword.tsx:79 calls `supabase.auth.updateUser` directly; backend tokenVersion never bumped (only PATCH /auth/me/password does it, auth.controller.ts:503).
- Expected: after resetting a password (typical after a suspected compromise), other sessions die, as the change-password path documents.
- Actual: every existing 7-day session cookie keeps working.
- Evidence: code trace; no backend call in the reset flow; JwtStrategy only checks `tv` (jwt.strategy.ts:70).
- Why silent: success screen says password updated; nothing tells the user other devices are still in.
- Fix: complete the reset through a backend endpoint (verify the Supabase recovery session/token server-side, then `revokeAllSessions`), or have the backend bump tokenVersion on a Supabase auth webhook. Files: ResetPassword.tsx, auth.controller.ts, password-auth.service.ts.

**E-03 OAuth + 2FA: a wrong code hard-redirects to /login and the error is never shown** - Medium (only with TWO_FACTOR_ENABLED)
- Where: frontend/src/api/client.ts:142-150 (401 handler; `isAuthCheckRequest` only exempts /auth/csrf and /auth/me; redirect skipped only when pathname === '/login'); backend two-factor.service.ts:112 throws 401 'Invalid code.'.
- Expected: "Invalid code" under the field on /login/2fa.
- Actual: `window.location.href = '/login'`; challenge token in the fragment is lost, user must redo OAuth, no message.
- Evidence: test `frontend/src/api/client.auth-redirect.silent-audit.test.ts` FAILS (location.href becomes "/login").
- Why silent: user lands on the plain login form with no explanation.
- Fix: exempt `/auth/2fa/login` and `/auth/login` from the global 401 redirect, or make the backend return 400 for a wrong code (like confirm/disable already do). Files: api/client.ts or two-factor.service.ts.

**E-04 One-click "pre-configured agent" download produces an .exe that ignores the embedded key** - High
- Where: frontend/public/downloads/pmaxing-agent.exe (committed 2026-07-19, f907648) vs agent/internal/config/embedded.go:30 (V2 markers + base64 since 7bbc80f, 2026-07-24) vs DownloadSetupButton.tsx (appends V2).
- Expected: download, double-click, agent runs with the generated key.
- Actual: the shipped binary only knows `#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-START--#` (verified with grep -a on the .exe: V1 markers present, V2 absent). It never finds the V2 payload, falls back to env/config.json and stops with "no embedded config, no PMAXING_API_KEY..."; meanwhile a new API key was created on every click (orphans). The binary also predates the https-only baseUrl check and the 45s timeout.
- Evidence: `grep -a -o "#--PMAXING-AGENT-EMBEDDED[A-Z0-9-]*--#" frontend/public/downloads/pmaxing-agent.exe` -> V1 START/END only; git log dates above.
- Why silent: the site shows nothing wrong; the agent error tells the user to generate a key, which they think they did.
- Fix: rebuild the vanilla .exe from current agent/ source and commit it; add a CI check that the binary contains the current marker string. Files: frontend/public/downloads/pmaxing-agent.exe, a workflow.

**E-05 Clearing quiet hours, commute minutes or addresses shows "Saved." but changes nothing** - Medium
- Where: frontend/src/components/Schedule/CommuteSettingsCard.tsx:118-127 (empty -> `undefined` / quiet hours omitted), backend auth/dto/update-profile.dto.ts (IsInt/IsString, no null), auth.service.ts:72-107 (undefined = untouched).
- Expected: emptying both quiet-hours fields (the UI explicitly allows "leave both empty") removes the sleep window used by study plan and reminders; emptying commute/addresses clears them.
- Actual: request omits the fields; DB keeps old values; response user has the old values, the useEffect on `user` refills the inputs, and the message says "Saved." (also hard-coded English, not i18n).
- Evidence: code trace; there is no code path that can write null to these columns.
- Why silent: success text; reminders keep being held by the old quiet hours.
- Fix: send `null` for cleared fields and accept `null` in the DTO (`@ValidateIf(v !== null)`), writing null in updateProfile; translate "Saved.". Files: CommuteSettingsCard.tsx, update-profile.dto.ts, auth.service.ts, userService.ts types.

**E-06 Banned/suspended user signing in with Google/GitHub/Discord gets a generic error, no blocked screen, no appeal** - Medium
- Where: account-guard.service.ts:27 throws 401 {code: ACCOUNT_BLOCKED, appealToken} inside the strategy; filters/oauth-conflict-redirect.filter.ts:45 turns any non-conflict error into `?error=oauth_failed`; AuthCallback.tsx shows "something went wrong".
- Expected: same AccountBlockedPage + appeal as the password login (Login.tsx:89).
- Actual: generic error; appealToken discarded; user never learns the account is restricted and cannot appeal.
- Evidence: code trace.
- Why silent: looks like a transient OAuth failure.
- Fix: in the filter, detect ACCOUNT_BLOCKED and redirect to `/login#blocked=<appealToken>` (fragment), and let Login/AuthCallback render AccountBlockedPage. Files: oauth-conflict-redirect.filter.ts, AuthCallback.tsx.

**E-07 Security logs lose blocked requests and stats count rows, not requests** - Medium
- Where: common/guards/logging-throttler.guard.ts:91-104 (after a flush, further 429s in the 5s window sit in `pending` and are flushed only by a later 429 for the same ip+path); security-logs.service.ts:107-118 (`count` of rows, `_count.ip`) ignore the `count` column; SecurityLogRow.tsx never shows `count`.
- Expected: Security page shows how many requests were blocked.
- Actual: a burst of 50 blocked requests is persisted as 1; the rest stay in memory forever (also an unbounded Map per unique ip+path, query strings included). "Blocked last hour" and "Top offending IPs" count rows.
- Evidence: test `backend/src/common/guards/logging-throttler.guard.silent-audit.spec.ts` FAILS (expected 50, received 1).
- Why silent: numbers look plausible, just small.
- Fix: flush pending buckets on a timer (setInterval/unref) or on next request regardless of key; use `_sum: { count }` in getStats and show the count column. Files: logging-throttler.guard.ts, security-logs.service.ts, SecurityLogRow.tsx/SecurityStatsCards.tsx.

**E-08 Admin pad moderation rows are shown as rate-limit blocks; userId of throttled requests is always empty** - Low
- Where: pads.service.ts:283/311 write ADMIN_PAD_* into SecurityLog; Security UI has no type column and stats count all types (admin's own IP becomes a "top offender" with a Ban button). logging-throttler.guard.ts:83 reads `req.user`, but the global throttler runs before route auth guards, so it is always undefined; the "User" column always says anonymous.
- Evidence: code trace (APP_GUARD order in app.module.ts:95-121).
- Fix: filter stats/list by type or add a type column; resolve the user from the cookie JWT if wanted, or drop the column.

**E-09 "Full" data export omits several data sets** - Medium (GDPR claim)
- Where: backend/src/users/users.service.ts:204-370.
- Expected: per its own comment, everything the platform stores about the user.
- Actual: missing work shifts, commitments, class occurrences/attendance, grade components and entries, academic periods (programs exported without include), task packs, friendships/blocks/view grants, notebook shares, feedback, appeals, agent config, push subscriptions (metadata), all profile settings (commute, addresses, quiet hours, reminder prefs), private areas owned by the user that have no task/session/entry (usedAreaIds only; comment "Area has no userId" is stale since Area.ownerId exists).
- Evidence: compare the Promise.all list with the User relations in schema.prisma:197-393.
- Why silent: the JSON downloads fine.
- Fix: add the missing relations and the settings fields to the select. File: users.service.ts.

**E-10 Change/add password success message is wiped instantly** - Low
- Where: hooks/usePasswordForm.ts:87 calls `onUserUpdate({...user, hasPassword:true})` -> Profile updateUser -> EditProfileModal.tsx:37-45 effect on `[isOpen, user]` runs `passwordForm.reset()` -> `setPasswordSuccess(false)`.
- Expected: "Password updated successfully" stays (comment at EditProfileModal.tsx:21 says so).
- Actual: fields collapse with no confirmation.
- Fix: depend only on `isOpen` in that effect (or on user.id). File: EditProfileModal.tsx.

**E-11 Load/create failures on Developer and Agent pages look like normal states** - Low
- Where: hooks/useApiKeys.ts:28-35 (load error -> keys [] -> "You don't have any API keys"); useApiKeys.ts:41-52 + Developer.tsx:31 (create error, e.g. 429 at 5/min, rejects unhandled, no message); hooks/useAgentConfig.ts:56-66 + Agent.tsx:90 (load error -> config null -> skeleton forever).
- Fix: keep an error state and render it. Files: useApiKeys.ts, Developer.tsx, useAgentConfig.ts, Agent.tsx.

**E-12 Agent counts date-only tasks as overdue for the whole due day (blocks apps on the day of the exam)** - High (default rule)
- Where: agent/internal/rules/rules.go:131 `t.Date.Before(now)`; default `hasOverdueTasks: true` (agent-config.service.ts:12).
- Expected: same deadline as the app (end of the due day for UTC-midnight dates, frontend utils/taskDateStatus.ts getDeadlineMs, fixed 2026-10-20). The rules.go comment claims to match the app; it no longer does.
- Actual: from 00:00 UTC of the due day the agent blocks configured sites/processes because of a task the app shows as "Today".
- Evidence: test `agent/internal/rules/silent_audit_test.go` FAILS ("got block=true"). Note: on this machine `go test` needs `GOTMPDIR` outside %TEMP% (Application Control blocks the test exe there).
- Why silent: the tray just says "blocking active"; the reason in the log says "past deadline".
- Fix: treat UTC-midnight dates as due at +24h in hasPastDeadline (mirror isUtcMidnight); add the case to rules_test.go. File: agent/internal/rules/rules.go.

**E-13 Revoked/deleted API key: agent keeps blocking with the last decision and never surfaces it** - Medium
- Where: agent/main.go:236-245 (any FetchAgentConfig error, including the explicit 401 from agentconfig.go:166, reuses previousRemote) and :262-280 (tasks 401 -> failMode CLOSED keeps last ShouldBlock).
- Expected: a revoked key stops the agent or shows "key revoked" in the tray.
- Actual: if the last decision was "block", blocking continues indefinitely; message only in agent.log. Tray shows "blocking active".
- Fix: distinguish 401 (typed error) from network errors; on 401 remove blocks and show the reason in tray status. Files: apiclient/*.go, main.go, tray/status.go.

**E-14 Admin queues silently capped** - Low
- Where: feedback.service.ts:30 (`take: 300`), friend-code-requests.service.ts:74 (`take: 200`); UIs show no "more not shown".
- Fix: paginate like appeals/security logs, or show the cap.

**E-15 Process blocking reports kills that did not happen; names without ".exe" never match** - Low
- Where: agent/internal/blocker/process_windows.go:84-86 (`_ = cmd.Run()` then appended to `killed`); exact EqualFold against tasklist image names; Agent page BlockListEditor has no normaliser for processes (Agent.tsx:105).
- Fix: check taskkill exit code; normalise process entries (append .exe when missing) in the UI.

**E-16 Other minor auth UX swallows** - Low
- Login.tsx:97 maps 429/500/network to "Invalid credentials or server error."; Register.tsx:65 maps 409/400 (password < 8, no client-side check) to one generic message; ResetPassword.tsx:82 shows raw English Supabase text; Profile/Agent/Developer `useDocumentTitle('Profile'|'Agent'|'Developer')` hard-coded English; suspension message date formatted server-side (account-guard.service.ts:80, `toLocaleDateString()` in server locale).

#### Suspected (missing proof)
- E-S1 /auth/csrf trusts a revoked token (session-token.service.ts:28 checks only the signature): after "log out everywhere" another device boots as authenticated, renders the app briefly, then the first API 401 redirects to /login. Missing: browser confirmation of the UX; impact likely only a flash.
- E-S2 Client crash reports with message > 500 or stack/componentStack > 8000 chars get 400 (report-client-error.dto.ts) and are dropped by `.catch(() => {})`. Missing: real React 19 componentStack lengths in prod.
- E-S3 Web vitals CLS/INP are reported on page hide; axios XHR is often aborted on unload, so these metrics are mostly lost. Missing: network capture. Fix would be navigator.sendBeacon/fetch keepalive.
- E-S4 Ban/suspend and role/tokenVersion caches are per process (account-status.service.ts, session-state.service.ts 30s, banned-ips.service.ts). With more than one Render instance a ban only applies on the instance that handled it until restart. Missing: deployment instance count (comments assume one).
- E-S5 Agent config priority: embedded config beats PMAXING_API_KEY (config.go:63-77). A user who downloaded an embedded .exe, revoked that key and ran `-set-key NEW` keeps using the old key; README says env var is tried first. Also `-set-key` output is invisible with the windowsgui build. Missing: run on Windows.
- E-S6 Friend-code approval: request marked APPROVED before rotateFriendCode; if rotation throws, it stays approved with the old code (friend-code-requests.service.ts:100-110). Missing: a failure path for rotateFriendCode.
- E-S7 Accessibility (E-12 in inventory): AccessibilityEffects and AccessibilitySettingsCard each hold their own useAccessibilityPrefs state; the root instance keeps the page-load prefs. With "system" stored at load and "light" chosen later, an OS theme switch re-applies the stale "system" theme; choosing "system" in Profile stops following the OS after leaving Profile. Code trace is clear; missing a browser check.
- E-S8 Agent README says GET /tasks is the full history; backend returns only the active period (tasks.service.ts:157-171). Rules ignore other periods. Probably intended, doc drift.
- E-S9 deadlinePushReminders can be on with no push subscription on any device; help text mentions it, nothing checks it (area d overlap).

#### Checked and fine
- CSRF double-submit + one retry after refresh (client.ts:122-139, csrf.guard.ts); telemetry/verify/2FA/password-link correctly @SkipCsrf.
- 401 interceptor exemption also covers /auth/me/password, so a wrong current password shows the right message (usePasswordForm.ts:95).
- tokenVersion bump on logout and change password; new cookie issued for current session.
- 2FA: TOTP replay guard, recovery codes single-use, lockout (in-memory, documented), feature flag 404.
- OAuth login state cookie + link state bound to session; conflict filter redirect.
- Email verification token derived secret, idempotent verify, resend cooldown.
- Forgot password sends password-link for OAuth-only accounts; generic responses by design.
- Account blocked mid-session: interceptor event + 30s watcher + appeal via blocked-aware guard.
- Appeals: limits/cooldown, atomic resolve, cache cleared on approve; paginated UI.
- Users admin: role change invalidates session cache; suspend/ban/reactivate update cache; errors toasted.
- Banned IP guard O(1), health exempt; maintenance guard + MaintenanceGate.
- Task meta cache invalidated by every task-type/priority write; single provider in CommonModule.
- API keys: scrypt hash, scope downgrade for non-admins (documented), ban check on API-key path, lastUsed best-effort.
- Agent config DTO vs frontend payload match (forbidNonWhitelisted safe); poll interval clamp 15-3600 both sides; agent throttle 20/min OK.
- Agent hosts file: atomic write, managed block, removal on exit; https enforced (in source); fail-closed decision does not accumulate suffix.
- Preferences toggles: saved and read (reminders, spaced reviews, notes privacy).

### New test files (all fail while the bug exists)
- backend/src/auth/services/password-auth.email-case.silent-audit.spec.ts (E-01)
- backend/src/common/guards/logging-throttler.guard.silent-audit.spec.ts (E-07)
- frontend/src/api/client.auth-redirect.silent-audit.test.ts (E-03)
- agent/internal/rules/silent_audit_test.go (E-12; run with GOTMPDIR outside %TEMP%)

### Not covered
- No live OAuth/Supabase/SMTP; no Windows run of the agent (only go test on rules). E-04 verified by inspecting the committed binary bytes, not by running it.

### Área f. Transversal: service worker, PWA, i18n, datas, offline, várias tabs

#### Confirmed

**F-01 Refresh or SW auto-update silently ends the running Focus session** (High)
- Where: frontend/src/context/StudySessionProvider.tsx:208-218; frontend/src/pwa/registerSW.ts:12-24 + vite.config.ts:51 (`registerType: 'autoUpdate'`)
- Expected: a reload keeps the session (the code itself says the plan "ao mudar de sessao (ou de tab, ou recarregar) volta a ser lido de la", line 126). Actual: `pagehide` fires on every reload (F5, mobile pull-to-refresh, PWA reload) and, if this is the only tab, calls `stopStudySessionOnUnload` (keepalive PATCH /study-sessions/:id/stop with the in-memory CSRF token). The new page then gets no active session.
- Trigger without user action: vite-plugin-pwa 1.3.0 `register.js` autoUpdate branch: `wb.addEventListener("activated", e => { if (e.isUpdate || e.isExternal) window.location.reload() })` (no `onNeedReload` passed in registerSW.ts). After any deploy, the first load (or an update check from a push event) reloads the page a few seconds later and the session is stopped.
- Evidence: code trace above (node_modules/vite-plugin-pwa/dist/client/build/register.js lines 41-49).
- Why silent: timer just disappears, no "session stopped" message; `justStopped` prompt not shown; duration is recorded truncated.
- Fix: in pagehide, skip the stop when the navigation is a reload (persist "stopping at T" in sessionStorage and cancel on next load within a few seconds, or rely only on the heartbeat/auto-close); pass `onNeedReload` to registerSW to defer reload while a session or unsaved edit exists. Files: StudySessionProvider.tsx, registerSW.ts.

**F-02 Wrong 2FA code on /login/2fa (OAuth + 2FA) hard-redirects to /login, error never shown** (High when TWO_FACTOR_ENABLED=true; also reported by area e)
- Where: frontend/src/api/client.ts:78, 140-149; backend/src/auth/services/two-factor.service.ts:112 (`UnauthorizedException('Invalid code.')`)
- Expected: "Invalid code" in TwoFactorCodeForm, retry. Actual: 401 not in AUTH_CHECK_ENDPOINTS, and pathname `/login/2fa` !== `/login`, so `window.location.href = '/login'`. The one-time challenge token in the hash is lost; user must redo the whole OAuth flow. Same for "Login expired" 401.
- Evidence: frontend/src/api/client.silent-audit.test.ts (FAILS: expected href unchanged, received '/login'). Note: this file was created by me and then rewritten on disk by the area e agent with an equivalent test.
- Why silent: page silently restarts at login.
- Fix: exempt `/auth/2fa/login` and `/auth/login` from the 401 redirect (or only redirect when a session existed), or return 400 for a wrong code like `/2fa/confirm` already does. Files: client.ts or two-factor.service.ts.

**F-03 Push subscription stays bound to the previous account on a shared browser** (High; overlaps d/e)
- Where: frontend/src/context/AuthContext.tsx:74-85 (logout never unsubscribes), backend/src/auth/auth.controller.ts:237-254 (logout does not delete PushSubscription), frontend/src/hooks/usePushNotifications.ts:57, pwa/PushPromptDialog.tsx:16,60
- Expected: user B logging in on the same browser gets their own notifications. Actual: browser still has A's subscription, so `refresh()` reports `'on'`; PushPromptDialog treats `'on'` as NOTHING_TO_ASK and Profile shows "on". B never calls /push/subscribe, so the DB row keeps `userId = A`: B receives nothing, and A's pushes (deadline titles, friend/share requests with names, turma announcements) appear on B's device.
- Evidence: code trace; backend upsert by endpoint only runs on /push/subscribe (push.service.ts:99-113).
- Why silent: UI shows notifications enabled.
- Fix: on logout call unsubscribePush(endpoint) (or delete the user's row for this endpoint server-side on logout); on login re-POST /push/subscribe when a browser subscription exists. Files: AuthContext.tsx, usePushNotifications.ts, auth.controller.ts.

**F-04 Overdue check-in prompts lost for the whole day after a navigation or reload** (Medium)
- Where: frontend/src/hooks/useOverdueCheckins.ts:29-36; frontend/src/components/Layout/PageLayout.tsx:37
- Expected: unanswered overdue tasks keep being asked (backend `findPendingOverdueCheckins` still returns them). Actual: PageLayout is rendered per page (46 pages), so the hook remounts on each navigation; the gate `localStorage[pmaxing:lastOverdueCheckDate] === todayKey()` returns early and `pendingTasks` restarts empty. Also `localStorage.setItem` runs even when `cancelled` (response arrives after the user navigated away, e.g. Render cold start), so the prompt is never shown that day. Key is not per user (user B on same browser skipped) and uses the UTC day (F-09).
- Evidence: code trace (setItem at line 35 is outside the `if (!cancelled)`).
- Why silent: modal simply never appears.
- Fix: write the key only after the queue is empty/answered and only when not cancelled; key per user id; or lift state to a provider. Files: useOverdueCheckins.ts, PageLayout.tsx.

**F-05 CSRF auto-retry replays a stale tab's write into a different account** (Medium, rare)
- Where: frontend/src/api/client.ts:121-137, 37-51
- Expected: tab A (user A) cannot write once tab B logged in as user B. Actual: B's login replaces the cookies; A's next write gets 403 CSRF, `refreshCsrfToken()` gets B's token (`authenticated: true`) and `api.request(error.config)` replays A's payload as B (e.g. a wellbeing check-in, pad edit, notebook entry without foreign ids). Tab A keeps showing A's name (AuthContext user not refreshed).
- Evidence: code trace; retry has no user identity check.
- Why silent: request succeeds.
- Fix: return the user id from /auth/csrf and compare with AuthContext user before retrying; on mismatch force reload. Files: client.ts, auth.controller.ts csrf endpoint.

**F-06 i18n: ~78 strings per language are English copies; check-i18n blind spots** (Medium)
- Where: frontend/src/i18n/messages/{pt,es,fr,de,ja,ko,zh}/fase7.ts (73 keys) and meds.ts (5 keys): whole Turmas, Pads, collab conflict ("Someone else saved this while you were typing..."), wellbeing insights, medication intake errors (`wellbeing.meds.intake.saveError`, `timeInvalid`, `deleteMessage`...) are English in all 7 languages. `scripts/check-i18n.mjs` reports "2561 chaves, 8 linguas, 0 problemas".
- Other blind spots verified: script does not detect value == English; does not check keys used in code exist (my scan found none missing today); does not check vars passed by callers; only parses single-line `'k': "v"` entries. Hardcoded English UI: CalendarSyncReviewModal.tsx:9-13 (`Add/Update/Remove`); backend messages shown raw via getApiMessage (httpError.ts:22) e.g. "Invalid code.", account-guard `toLocaleDateString()` in server locale.
- Evidence: scratchpad script i18n-same.mjs output (78 identical long strings per language, same key list in each).
- Why silent: no fallback marker; CI check passes.
- Fix: translate fase7/meds keys; add an "identical to en" warning (with allow-list) to check-i18n.mjs. Files: messages/*/fase7.ts, meds.ts, scripts/check-i18n.mjs.

**F-07 Module/session caches store a transient failure as the final answer and survive logout** (Medium)
- Where: frontend/src/hooks/useCalendarStatus.ts:33-37 (`cachedStatus = false` on any error, kept until refreshCalendarStatus); CommandPalette.tsx:249-261 (`.catch(() => setTasks([]))`, `.catch(() => setAreas([]))`, never refetched because `tasks !== null`)
- Expected: a failed fetch is retried. Actual: one 5xx/timeout (Render cold start) makes the whole session behave as "Calendar not connected" (CalendarSyncReviewModal never opens, sync card hidden) and the palette finds no tasks and quick add says "needs an area". Logout is SPA (Navbar.tsx:27-29, no reload), so `cachedStatus` of user A is reused for user B.
- Evidence: code trace.
- Why silent: shows a valid-looking empty/disconnected state.
- Fix: keep `null` (unknown) on error and retry; reset caches on logout. Files: useCalendarStatus.ts, CommandPalette.tsx, AuthContext.tsx.

**F-08 Push notification language frozen at subscribe time** (Low)
- Where: frontend/src/hooks/usePushNotifications.ts:89 (lang sent only in enable()), i18n/I18nProvider.tsx setLang; backend push.service.ts:106-112, 209
- Expected: changing the app language changes notification language. Actual: the stored `lang` on PushSubscription is only updated on /push/subscribe; setLang never re-posts it.
- Fix: on language change, if subscribed, re-POST /push/subscribe with the new lang. Files: I18nProvider.tsx or usePushNotifications.ts.

**F-09 Three different "today"s: UTC (todayKey), browser-local (todayUtcAnchored), Lisbon (backend)** (Medium)
- Where: frontend/src/lib/dateKey.ts:10-12; utils/taskDateStatus.ts:16-20; users of todayKey(): TaskForm.tsx:57 (default date), ShiftForm.tsx:54, shiftText.ts:34, BulkActionsBar.tsx:95 ("Today" reschedule), StudyActivityCard.tsx:96 (goal vs Lisbon-keyed totals from study-sessions.service.ts:454-487), SessionForm.tsx:54, useActivePeriodRange.ts:15, useOverdueCheckins.ts:29, UserStatusModal.tsx:80, OnboardingChecklist.tsx:22
- Expected: "today" = the user's calendar day. Actual: 00:00-01:00 in Lisbon summer, todayKey() is yesterday; a task due today shows "upcoming", one due yesterday shows "today" instead of overdue, the new-task default date is yesterday, the goal ring shows yesterday's minutes. For users west of UTC (e.g. Brazil, UTC-3) the window is 21:00-24:00 every day and tasks due today show "overdue".
- Evidence: frontend/src/lib/dateKey.silent-audit.test.ts (4 tests FAIL: todayKey '2026-07-14' vs local '2026-07-15'; getDateStatus 'upcoming' vs 'today'; 'today' vs 'overdue'; UTC-3 'overdue' vs 'today').
- Why silent: wrong labels look plausible.
- Fix: make todayKey() use the local calendar day (as todayUtcAnchored) and compare task keys against it in getDateStatus; decide one app time zone policy (Lisbon or user tz) and send it to the backend. Files: lib/dateKey.ts, utils/taskDateStatus.ts.

**F-10 Offline: installed PWA does not open; OfflineBanner comment claims the shell loads from SW cache** (Low)
- Where: vite.config.ts:105-108 (`globPatterns` without html, `navigateFallback: null`); pwa/OfflineBanner.tsx:8-11
- Expected (per comment): offline UI shell loads, banner explains. Actual: index.html is never cached, so opening/reloading offline shows the browser's network error page; banner only helps in an already-open tab.
- Fix: precache index.html with NetworkFirst for navigations, or correct the comment/expectation. Files: vite.config.ts, OfflineBanner.tsx.

**F-11 "Best times" heatmap shows UTC hours and UTC weekdays as if local** (Low)
- Where: backend/src/study-sessions/study-sessions.service.ts:412-414 (`getDay()`/`getHours()` in process tz = UTC on Render); frontend/src/components/Study/BestTimesHeatmap.tsx:12 labels '00-04'... with no conversion (StudyNowHint.tsx:7 does convert, the heatmap does not)
- Expected: local hours. Actual: in Lisbon summer, a session at 08:30 lands in '04-08'; 00:30 Monday shows as Sunday 20-24.
- Fix: bucket by Lisbon time (Intl like toLisbonDateKey) or convert in the frontend. Files: study-sessions.service.ts, BestTimesHeatmap.tsx.

**F-12 Pad / turma note edits typed in the last 800 ms are dropped on leave, no unsaved-changes guard** (Medium; overlaps c)
- Where: frontend/src/hooks/useVersionedDoc.ts:77, 105-112
- Expected: like useEntryAutosave (flush on unmount + beforeunload). Actual: unmount/`key` change only clears the debounce timer; no flush, no beforeunload. Status 'dirty'/'error'/'conflict' edits are lost on navigation, slug change, or tab close.
- Evidence: code trace (compare hooks/useEntryAutosave.ts:115-128).
- Why silent: "Unsaved changes" label disappears with the page.
- Fix: flush on unmount and add a beforeunload listener while status !== 'saved'. Files: useVersionedDoc.ts.

#### Suspected

**F-S1 notificationclick: client.navigate on an uncontrolled window rejects** (Low) push-sw.js:36-41. `matchAll({includeUncontrolled:true})` can return a window the SW does not control (first visit before claim); `WindowClient.navigate` then rejects and the click only focuses the old page. Missing: browser test.

**F-S2 notificationclick navigate() reloads the whole page** (Low) push-sw.js:39 full navigation loses in-memory state (unsaved pad edits per F-12, and triggers pagehide -> F-01 stops the Focus session if single tab). Missing: confirm pagehide fires on SW-initiated navigate (spec says yes).

**F-S3 (merged into F-S1).**

**F-S4 Backend unavailable at startup looks like a logout** (Medium) AuthContext.tsx:38-49: any error from /auth/csrf (network, 502 on Render cold start, timeout) sets isAuthenticated=false; PrivateRoute redirects to /login with no "server unavailable" message. Missing: confirm fetchCsrfToken rejects on 5xx (axios does by default) and how Login shows errors then.

**F-S5 Language switch silently does nothing when the chunk fails** (Low) I18nProvider.tsx:34-41 `.catch(() => undefined)`. Offline or after a deploy (old chunk hash) the click has no effect and no message.

**F-S6 Missing VITE_API_URL in a production build silently targets http://localhost:3000** (Low) apiBaseUrl.ts:4-6; build does not fail; all requests fail as mixed content. Missing: Netlify env confirmation (CSP connect-src would also block).

**F-S7 Per-browser localStorage survives logout** (Low) task templates, saved filter views, focus break `pmaxing:focus-break` (BreakBanner shown to next user), last areas, onboarding dismissed: user B sees A's templates/saved views and A's rest break. Only `pm-push-prompt-answered:<id>` is per user.

**F-S8 Dev on phone over http LAN IP white-screens** (Low, dev only) lib/tabPresence.ts:43 `crypto.randomUUID()` at module load is undefined outside secure contexts (vite `server.host: true`).

**F-S9 401 redirect drops the return path** (Low) client.ts:147 uses `/login` without `?redirect=`, unlike PrivateRoute.tsx:21.

**F-S10 MAINTENANCE_MODE accepts only 'true'/'1'** (Low) maintenance.guard.ts:24-27 vs isEnvFlagOn (true/1/yes/on) in app.config.ts:14-17; `MAINTENANCE_MODE=yes` silently ignored.

#### Checked and fine
- SW never caches API/auth responses (NetworkOnly + no other API rule); /sw.js and /index.html no-cache; /assets immutable.
- ErrorBoundary shows reload for lazy-chunk failures after a deploy.
- dedupeGets: per-caller copy, per-caller cancel (test exists).
- CSRF refresh is single-flight and retried once only.
- 401 on `/auth/me/password` (wrong current password) is exempt from logout because `'/auth/me/password'.includes('/auth/me')`.
- Multi-tab focus sync via BroadcastChannel + visibility refetch; last-tab detection with 15 s TTL.
- Idle detection shared via localStorage; never stops session by itself.
- useHealthCheck single poll, visible-only.
- All Command palette nav paths and query params are handled by their pages; admin entries gated.
- GlobalStudyTimerHost / PushPermissionPrompt / CommandPaletteHost lazy hosts mount whenever their condition is true (no "never mounts" case found).
- AcademicProvider reloads on user id change.
- i18n: no key used in code missing from en; all apparent placeholder mismatches are fillNodes calls (verified manually).
- Backend env: required vars asserted at boot; FRONTEND_URL required in prod; optional features degrade with a log.
- Quick add parses dates in the local calendar day.

#### Not covered
- No browser run (rules): SW update timing, notificationclick, offline behaviour verified by reading vite-plugin-pwa 1.3.0 source only.
- Hook-level React tests impossible without jsdom (not installed); F-01, F-04, F-12 proven by trace only.

New test files:
- frontend/src/lib/dateKey.silent-audit.test.ts (4 failing tests, F-09)
- frontend/src/api/client.silent-audit.test.ts (failing, F-02; created by me, later rewritten by the area e agent)
- Scratchpad scripts (not in repo): C:\Users\Rodrigo\AppData\Local\Temp\claude\D--Productivity-Maxing\072a5684-62fc-4e25-85dd-1147a7ec52ef\scratchpad\i18n-audit.mjs, i18n-same.mjs

## 4. Verificado e OK

Cada área tem a sua lista "Checked and fine" na secção 3. Cada item do [inventário](inventory.md) está num destes sítios: Confirmado, Suspeito, Checked and fine ou Não coberto.

## 5. Não coberto (e porquê)

- **Verificação dinâmica com backend: não feita.** `backend/.env` aponta para Supabase (`aws-0-eu-west-1.pooler.supabase.com`), por isso arrancar o backend local tocaria em produção (regra 3). O Docker não estava a correr. Para a fase 3 completa é preciso uma BD local descartável (Postgres em Docker, migrações aplicadas pelo utilizador) e um `.env` local. Sem isso, os fluxos com backend foram provados por testes unitários (Jest) e traço de código.
- **Browser e dispositivos reais:** viewport de telemóvel, ecrã bloqueado no Android/iOS, Safari, permissão de notificações negada, duas tabs, PWA instalada offline. Precisam de backend e/ou de um dispositivo. Afeta a-02, a-04, D-14, D-15, D-18, D-20, F-10 e a confirmação visual de a-03, D-06 e D-07.
- **Hooks React:** o frontend não tem jsdom nem testing-library, por isso os findings de hooks (a-03, a-06, B-08, C-01 a C-04, C-06, F-01, F-04, F-07, F-12) ficaram provados só por traço de código.
- **Grade projection / previsão de média do curso** (`backend/src/study-plan/grade-projection.service.ts`): a área a deixou-a para a b, e a b para a a. Não foi auditada.
- **`study-plan.scheduler.ts`** (563 linhas): só lido por alto (encaixe de blocos, overtime, revisões).
- **API do Google Calendar com tokens revogados, entrega real de push e SMTP:** proibido chamar serviços externos.
- **Dados de produção** (volumes reais para os `take` escondidos, contas afetadas por E-01, se `TWO_FACTOR_ENABLED` está ligado em produção, se o repositório é público, o que afeta D-19).

## 6. Ficheiros de teste criados pela auditoria (todos falham enquanto o bug existir)

Backend (`cd backend && npx jest <path>`):
- `src/wellbeing/medications.silent-audit.spec.ts` (D-01, D-02; 1 teste de controlo passa)
- `src/tasks/tasks.silent-audit.spec.ts` (B-01, prioridade de B-05, B-03; 1 controlo passa)
- `src/areas/areas.silent-audit.spec.ts` (B-04)
- `src/notebook/notebook.service.silent-audit.spec.ts` (C-08)
- `src/auth/services/password-auth.email-case.silent-audit.spec.ts` (E-01)
- `src/common/guards/logging-throttler.guard.silent-audit.spec.ts` (E-07)
- `src/study-sessions/study-sessions.service.silent-audit.spec.ts` (a-01, a-02)
- `src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts` (a-08; correr com `TZ=UTC npx jest <path>`, sem isso passa por acaso neste PC)
- `src/work-shifts/work-shift-copy.service.silent-audit.spec.ts` (a-05)

Frontend (`cd frontend && npx vitest run <path>`):
- `src/pwa/notifications.silent-audit.test.ts` (D-03, D-04, D-05)
- `src/utils/taskPayload.silent-audit.test.ts` (B-05, 8 casos)
- `src/components/Notebook/entry/notebookEntryDate.silent-audit.test.ts` (C-05)
- `src/lib/dateKey.silent-audit.test.ts` (F-09)
- `src/api/client.auth-redirect.silent-audit.test.ts` (E-03 / F-02)
- `src/utils/parseIcsSchedule.silent-audit.test.ts` (a-10)

Agent (`cd agent && go test ./internal/rules/`, com `GOTMPDIR` fora de `%TEMP%`):
- `internal/rules/silent_audit_test.go` (E-12)

Depois da fase 5 todos estes testes passam e ficam como testes de regressão.

## 7. Fase 5: resultado das correções (2026-10-25)

O utilizador aprovou corrigir todos os Confirmados. Dos 74, **69 foram corrigidos** e **5 ficaram parciais**. Nenhum ficou por fazer. Nenhuma alteração ao schema e nenhuma migração. Não foi feito nenhum commit.

### Parciais (o que falta e porquê)

| ID | Feito | Falta | Precisa de |
|---|---|---|---|
| a-04 | Aviso por baixo do seletor de timer: no telemóvel, os alertas só chegam com a app aberta | Push do servidor no fim do bloco | Decisão: agendador durável e `plannedEndAt DateTime?` em StudySession (`npx prisma migrate dev --name study-session-planned-end`) |
| C-17 | "Partilhados comigo" e "As minhas partilhas" dizem "a mostrar os 100 mais recentes" | Paginação. Ainda há 4 listas cortadas sem aviso: badges de partilha depois da nota 100, notas de amigos (300), acessos às notas (200), cadeiras ligadas à turma (200) | Decisão de produto |
| D-12 | Email de lembrete de prazo na língua do utilizador (8 línguas, língua da subscrição push mais recente) | Emails de reset, verificação e link de password continuam em inglês | `User.language` (`npx prisma migrate dev --name user_language`) |
| E-08 | As estatísticas contam só linhas de rate-limit; a moderação de pads tem etiqueta própria | Os 429 continuam "anónimos" (o throttler corre antes da autenticação) | Decisão de design (ler o cookie de sessão no throttler) |
| E-16 | A página de reset já não mostra texto cru do Supabase | A data de suspensão é formatada no servidor e aparece em inglês por instantes | Pequeno, opcional |

E-14 foi corrigido com um aviso de "lista cortada", não com paginação.

### O que tens de fazer

1. **Deploy do backend e do frontend em conjunto.** Há endpoints novos ou alterados: `POST /auth/reset-password` (E-02), `GET /push/status` (D-08), o heartbeat das sessões com `plannedEndAt` (a-02) e `/auth/csrf` passou a devolver `userId` (F-05).
2. **Fazer commit de `frontend/public/downloads/pmaxing-agent.exe`.** Foi reconstruído a partir de `agent/` (marcadores V2, inclui E-12, E-13, E-15). Não foi executado.
3. **E-01: verificação só de leitura de emails duplicados por maiúsculas.** O SQL está em `fix-e.md`. Nenhuma linha existente foi alterada.
4. **Verificações manuais** (não há jsdom no frontend, por isso não há teste automático):
   - C-01: com o editor do dono aberto, gravar como co-owner em /shared/:token e depois escrever como dono. Deve aparecer um aviso de conflito.
   - a-02: no telemóvel, começar um bloco de 25 min, bloquear o ecrã ~20 min e desbloquear. O timer deve continuar.
   - D-08: abrir /wellbeing com lembretes ligados e sem dispositivo. Deve aparecer o aviso, e ao ligar as notificações o aviso desaparece.
   - B-02: arquivar o período ativo, criar uma task e confirmar que aparece no plano de hoje.
   - B-08: ficar offline com o modal de overdue aberto e responder. Deve aparecer erro e "Perguntar mais tarde".
   - E-10 e E-11: mudar a password (o texto de sucesso deve ficar); bloquear a API no devtools e abrir /developer e /agent.
   - D-05: deixar /wellbeing aberto depois da meia-noite de Lisboa e voltar à tab. A lista deve recarregar para o novo dia.
   - F-10: depois do deploy, instalar a PWA, abrir uma vez online, ficar offline e recarregar.
5. **Revisão por um falante nativo** das traduções novas em ja, ko e zh (F-06 encontrou 141 textos em inglês, não ~78).
6. **Política de Privacidade:** confirmar que descreve o export mais completo (E-09).
7. **Armazenamento:** C-06 usa uma chave nova em sessionStorage, `pmaxing:notebook-unsaved:<id>`. Se o aviso de armazenamento listar o sessionStorage, deve incluí-la.

### Mudanças de comportamento a saber

- **Regra de "hoje" (F-09), escrita no topo de `frontend/src/lib/dateKey.ts`:** `todayKey()` passa a ser o dia local do browser, para toda a UI. `lisbonTodayKey()` serve só para dados que o backend guarda por dia de Lisboa (medicação, humor, totais de estudo). `toDateKey()` serve só para datas já ancoradas à meia-noite UTC.
- **a-03:** fechar a última tab já não pára a sessão de imediato. Fica a cargo do auto-close por heartbeat do backend, uns minutos depois. `lib/tabPresence.ts` deixou de ser importado e ficou no repositório.
- **B-04:** apagar uma Área com notas do caderno ou componentes de nota devolve 409 `AREA_IN_USE` com as contagens. Quatro tabelas ainda são apagadas em cascata com a Área, por serem dados ligados à própria Área: AreaScheduleLink, AreaInterest, AreaHidden e TurmaLinkedArea.
- **D-06:** o logout desliga as notificações neste dispositivo. No login seguinte, a app volta a perguntar.
- **D-01:** se a toma das 23:50 for marcada depois da meia-noite, fica no dia novo. O lembrete de ontem ainda pode disparar uma vez às 00:15; o texto do push já pede para confirmar antes de tomar.
- **check-i18n** passou a falhar quando uma tradução é igual ao inglês (há uma allowlist para casos intencionais).

### Verificações depois das correções

| Comando | Resultado |
|---|---|
| frontend `npx vitest run` | 159 testes OK (inclui todos os testes de reprodução, agora verdes) |
| frontend `npx oxlint` | 0 problemas |
| frontend `npx tsc -b --noEmit` | OK |
| frontend `check:i18n` | 2605 chaves, 8 línguas, 0 problemas |
| frontend `npx vite build` | OK (sw.js gerado com a rota offline) |
| backend `TZ=UTC npx jest` | 78 suites, 401 testes OK |
| backend `npx eslint` (sem `--fix`) | 0 problemas, depois de formatar 3 specs criados nesta auditoria e de remover um tipo não usado |
| backend `npx nest build` | OK |
| agent `go vet` + `go test ./...` (com `GOTMPDIR` no scratchpad) | OK |

Não foi possível fazer verificação no browser: o backend local apontaria para o Supabase de produção.

Os registos de correção por área, com ficheiros e testes de cada ID, estão na secção 8.

## 8. Registos de correção por área

### Área a

#### a-01 fixed
- backend/src/study-sessions/study-sessions.service.ts: stop() clamps endedAt to startedAt + MAX_SESSION_MINUTES (16 h) instead of a permanent 400; auto-close uses the same clamp (closeStale).
- frontend/src/context/StudySessionProvider.tsx: start/stop errors show the API message (getApiMessage) instead of the generic text.
- Test: study-sessions.service.silent-audit.spec.ts a-01, a-01b pass.

#### a-02 fixed
- Backend: heartbeat() no longer revives a stale session (no contact > 10 min). It closes it at the last heartbeat and answers 404, the same as GET /active, so the request race is gone. New optional body `plannedEndAt` (new DTO dto/heartbeat-study-session.dto.ts, controller passes it): while inside the planned block plus 10 min, the session stays alive. The value is capped at startedAt + 240 min.
- Frontend: studySessionsService.heartbeatStudySession(id, plannedEndAt?); the provider sends the plan end on every ping. On visibilitychange it sends a heartbeat first, then syncs. When a sync drops the session this screen showed (auto-close or another device), it shows a toast (new key ui.sessionEndedElsewhere, 8 languages) and clears the orphaned plan key.
- Test: a-02 spec. Corrected test 2: it called GET /active alone, but without the plan the server cannot tell a Pomodoro on a locked phone from a forgotten tab. It now models the fixed client flow (heartbeat with plannedEndAt, then GET /active). Test 1: the stale heartbeat now rejects, so the test catches it. Added 2 tests: a stale heartbeat closes the session, and a far-future plan is capped.
- Manual check: on a phone, start a 25 min block, lock the screen for about 20 min, unlock. The timer should still be running.

#### a-03 fixed (also covers F-01)
- StudySessionProvider.tsx: removed the `pagehide` keepalive stop and the registerTab use. A closed tab now relies on the heartbeat auto-close at the last contact (accurate to about 1 min). Reloads, the SW auto-update reload and the Calendar link no longer stop the session.
- studySessionsService.ts: removed the now-unused stopStudySessionOnUnload.
- registerSW.ts not changed: the reload is harmless now.
- lib/tabPresence.ts is no longer imported anywhere. I left it in place; the user can delete it.
- Test: none possible (the frontend has no jsdom). Checked by tsc.

#### a-06 fixed (came with the provider change)
- The provider's start/stop errors now also go to useFeedback().notify (toast), so they show on every page, not only on the /focus widget. On a 404 or 409 from stop, and a 409 from start, the provider calls syncActive().
- On /focus the error also stays inline (it can show twice there).

#### a-05 fixed
- work-shift-copy.service.ts and work-shift-copy.planner.ts: address and commuteMode added to COPY_FIELDS, ShiftSource, ShiftDraft, baseFields, the create data and loadExisting. Planner spec fixtures updated.
- Test: work-shift-copy.service.silent-audit.spec.ts passes.

#### a-08 fixed (also covers F-11)
- backend/src/common/date-key.util.ts: new toLisbonWeekdayHour(). getHeatmap() buckets by Lisbon weekday and hour. Updated the stale comment in study-plan.service.ts scoreSlot: the slot minutes and the buckets now use the same clock.
- frontend/src/lib/studyWindow.ts: "now" bucket in Lisbon time (it used UTC). It reuses APP_TIME_ZONE from lib/dateKey.ts. BestTimesHeatmap labels are Lisbon hours now, so they need no change.
- Tests: `TZ=UTC npx jest src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts` passes; new frontend/src/lib/studyWindow.test.ts.

#### a-10 fixed
- frontend/src/utils/parseIcsSchedule.ts: events with STATUS:CANCELLED are skipped. The import does not count them separately, the same as keyword-filtered events.
- Test: parseIcsSchedule.silent-audit.test.ts passes.

#### a-07 fixed
- frontend/src/hooks/useStopSession.ts: when the task update fails, the catch now shows a toast with the new key ui.couldNotMarkTaskDone (8 languages). The session is still not rolled back.
- Test: none (hook test needs jsdom). Checked with tsc and oxlint.

#### a-04 partial
- frontend/src/components/Study/focus/NotifyPermissionHint.tsx: when permission is granted, it now shows a muted hint (new key focus.notify.needsAppOpen, 8 languages). The hint says that on phones, alerts only arrive while the app is open. It appears under the timer mode picker whenever a countdown plan is selected.
- Left: a real server push at block end (PushService.notifyUser) was not built. It needs a durable scheduler: an in-memory setTimeout is lost when Render sleeps or restarts, and the reminders cron runs only every 15 min. It also needs the plan end stored server-side, which is a schema change (for example `plannedEndAt DateTime?` on StudySession, `npx prisma migrate dev --name study-session-planned-end`). This is a product and infra decision for the user.

#### Checks run
- Backend: jest study-sessions, work-shifts and study-plan (75/75, TZ=UTC); tsc clean; eslint clean on the changed files. eslint --fix was run only on the 3 repro spec files I edited (prettier).
- Backend, common/: the LoggingThrottlerGuard silent-audit test fails. It belongs to another area and is not caused by my changes.
- Frontend: vitest (studyWindow, parseIcsSchedule) passes; tsc -b clean; oxlint clean; check-i18n 0 problems.
- Deploy: deploy the backend and the frontend together. An old frontend still works with the new backend (plannedEndAt is optional), but it gets no locked-phone grace.

### Área b

Checks run at end of round: backend `tsc --noEmit` ok; `jest src/tasks src/areas src/academic-programs src/grade-components` 8 suites / 35 tests pass (includes tasks.silent-audit.spec.ts and areas.silent-audit.spec.ts); eslint clean on changed backend files (--fix only on grade-average.util.ts and tasks.service.ts, prettier wrapping of my own edits). Frontend `tsc -b` ok, `vitest run src/utils/taskPayload` 8/8 pass, oxlint clean on changed files, check-i18n 2584 keys / 8 languages / 0 problems.

No schema change, no migration needed for anything below.

#### B-01 fixed
- backend/src/tasks/tasks.service.ts `confirmOverdue`: when the task goes to COMPLETED (and was not already), calls `spawnFollowUps` (next occurrence + spaced reviews) and returns `spawnedTasks`, same as `update()`.
- Test: tasks.silent-audit.spec.ts "B-01" passes.

#### B-02 fixed
- backend/src/academic-programs/periods.service.ts: `archive()` now calls `moveActiveOffArchived()`; if the archived period was `User.activePeriodId`, active moves to the most recent non-archived period (same program first).
- frontend/src/context/academic-context.ts (+ `AcademicRefreshOptions`), AcademicContext.tsx: `refresh({ leavePeriodId })` never re-picks the just-archived period, persists the new pick (`activatePeriod`), and moves to another program if the current one has no active period left.
- frontend/src/components/Layout/ArchivePeriodButton.tsx and ManagePeriodsModal.tsx pass `leavePeriodId` after archiving.
- Test: no unit test (React context; vitest has no jsdom). Covered by trace + tsc. Manual check: archive the active period, create a task, confirm it appears in Today plan.
- Not done (sibling): switchPeriod still only console.errors if activatePeriod fails.

#### B-03 fixed
- tasks.service.ts `update()`: `academicType: null/''` clears the subcategory; when the type changes, the old subcategory is no longer reused.
- frontend/src/utils/taskPayload.ts sends `academicType: null` when empty.
- Test: tasks.silent-audit.spec.ts "B-03" passes.

#### B-04 fixed (Critical)
- backend/src/areas/areas.service.ts `remove()`: counts tasks, notebook entries and grade components (no user filter, so official areas count all users) and throws 409 `{ code: 'AREA_IN_USE', message, counts: { tasks, notebookEntries, gradeComponents } }`. Swagger description added in areas.controller.ts.
- frontend/src/hooks/useAreasPage.ts: maps AREA_IN_USE to translated `areas.deleteInUse` with the counts; confirm dialog uses new `areas.deleteConfirm` (mentions notes and grade components). Keys added in all 8 `messages/*/extra.ts`. Old key `hook.areYouSureAnAreaWith` now unused (left in place).
- Still cascading on area delete (low-value link/pref rows, not blocked): AreaScheduleLink, AreaInterest, AreaHidden, TurmaLinkedArea.
- Test: areas.silent-audit.spec.ts "B-04" passes.

#### B-05 fixed
- frontend/src/utils/taskPayload.ts: emptied optional fields go as `null` (weight, target/real grade, estimate, recalled minutes, notes, topics, link, calendar duration, academicType). Priority '' is cleared by backend.
- backend/src/tasks/dto/create-task.dto.ts: clearable fields typed `| null` (IsOptional already accepts null); tasks.service.ts `update()`: `priority ''|null` -> `priorityId: null`, weight null handled in budget check, and null on required fields (`REQUIRED_TASK_FIELDS`) returns 400 instead of a Prisma 500.
- Sibling: GradeComponentForm.tsx sends `expectedEntries: null`; grade-component.dto.ts + types/models.ts accept null.
- Tests: taskPayload.silent-audit.test.ts 8/8 pass; tasks.silent-audit.spec.ts "B-02" (priority) passes.

#### B-06 fixed
- backend/src/academic-programs/grade-average.util.ts: `computeWeightedAverage` collapses graded occurrences of a recurring series (same title + area + period, recurrenceFrequency set) into one item: mean grade, max weight. New `GRADED_TASK_SELECT` used by periods.service.ts and programs.service.ts (5 queries).
- Test: existing academic-programs specs pass; no dedicated new test yet (TODO next round: add a unit test in grade-average util).

#### B-07 fixed
- frontend/src/api/userService.ts: bulk status / reschedule / delete split into sequential batches of 200 (`BULK_TASK_BATCH_SIZE`, `chunkIds`), counts summed.
- frontend/src/components/Dashboard/BulkActionsBar.tsx: catch + error toast on mark done and delete (`bulkActions.markDoneFailed`, `bulkActions.deleteFailed`, 8 languages).
- Test: none yet (TODO: unit test for chunkIds).

#### B-10 fixed (also a-11)
- frontend/src/hooks/useTaskSelection.ts: `selectedSyncedCount`, `deleteSelected(removeFromCalendar)` unsyncs linked events before bulk delete (failures logged, do not block). BulkActionsBar asks like single delete (`bulkActions.removeEventsMessage`); pages/Dashboard.tsx passes `syncedCount`.
- Test: none (hook, no jsdom); tsc ok.

#### B-12 fixed
- tasks.service.ts `reorder()`: in the same transaction, tasks not in the list get `sortOrder += taskIds.length`, so they go after the reordered ones keeping relative order (matches useTasksPage local state).
- Test: none yet (TODO).

### Round 2

Checks: frontend tsc -b ok, oxlint clean on changed files, check-i18n 0 problems, vitest (new tests + taskPayload) 12/12; backend jest academic-programs/tasks/areas 28/28, eslint clean on new spec.

#### B-08 fixed
- frontend/src/hooks/useOverdueCheckins.ts: `hasError` set when an answer fails, `dismiss()` ("Ask me later") closes the queue for today. frontend/src/components/Tasks/OverdueCheckinModal.tsx shows the error (role=alert) with the "Ask me later" button; PageLayout.tsx wires it. Keys `overdue.saveFailed`, `overdue.askLater` in all 8 `messages/*/extra.ts`.
- Test: hook not unit-testable (no jsdom); tsc + trace. Manual check: go offline with the modal open and answer.

#### F-04 fixed
- New frontend/src/lib/overdueCheckKey.ts: key per user (`pmaxing:lastOverdueCheckDate:<userId>`), try/catch around storage, removes the old global key.
- useOverdueCheckins now takes the user id; the day key is written only when the fetch returns an empty queue (and the request was not cancelled), when the last task is answered, or on "Ask me later". Until then each page reloads the queue, and the backend filters tasks already answered today.
- Test: frontend/src/lib/overdueCheckKey.test.ts (key is per user and not the old key).
- Day key uses todayKey() (area f made it browser-local).

#### B-11 fixed
- frontend/src/hooks/useDurationPrediction.ts takes `areaId` and sends it. TaskFormFields.tsx (form) and TaskDetailView.tsx pass it. The backend DTO already accepted `areaId`.
- Test: none (hook); tsc ok.

#### B-13 fixed
- frontend/src/utils/parseTaskImportFile.ts: `mapImportRows` also returns `sheetRows` (the sheet row of each sent row). New pure `toSheetRowNumbers()`; useTaskImport.ts maps backend results back to sheet row numbers. Backend unchanged.
- Test: frontend/src/utils/parseTaskImportFile.rows.test.ts.

#### Extra tests
- B-06: backend/src/academic-programs/grade-average.util.spec.ts (10 quizzes at 10% plus a 90% exam average 11, not inflated).
- B-07: frontend/src/api/bulkBatches.test.ts (chunkIds 450 -> 200/200/50, empty -> none).
- B-12: still no unit test (transaction against mocked Prisma, low value).

### Área c
### Fix log area c (rounds 1 and 2)

Checks run at the end: backend `npx jest src/notebook src/social src/common/display-name.util.spec.ts` (81 passed), `npx tsc --noEmit`, eslint on changed files: clean. Frontend `npx tsc -b --noEmit`, `npx oxlint src`, `node scripts/check-i18n.mjs` (0 problems), `npx vitest run src/components/Notebook src/lib` (86 passed): clean. No schema change, no migration.

#### C-01 fixed
Optimistic concurrency on `NotebookEntry.updatedAt` (no schema change).
- Backend: `UpdateNotebookEntryDto.baseUpdatedAt` and `SharedEditDto.baseUpdatedAt` (optional, IsDateString). `NotebookService.update` and `NotebookCollabService.editShared` (OWNER/CO_OWNER) use `updateMany` with `updatedAt = base`; count 0 gives 409 `{ code: NOTEBOOK_ENTRY_CONFLICT, message, current }`. Without the field (old clients) behaviour is unchanged. Shared view now returns `updatedAt`.
- Frontend: `useNotebookEntries.updateEntry` sends the cached `updatedAt` and throws `EntryConflictError` (new `lib/notebookEntryConflict.ts`); `useEntryAutosave` has status `conflict` (no autosave while open), `keepMine`, `discard`; `NotebookEntryEditor` shows a banner "Keep my version" / "Load the latest version". `SharedEntryEditForm` sends the base and shows `sharedEdit.conflict` on 409.
- Tests: backend/src/notebook/notebook-entry-concurrency.spec.ts (5), frontend/src/lib/notebookEntryConflict.test.ts (2).
- Manual check: owner editor open + co-owner save via /shared/:token, then owner types: banner must appear.

#### C-02 fixed
Approving a proposal calls `onProposalApplied` and Notebook.tsx runs `reloadEntry` (refetch + replace cache/loadedEntry, new base version). Proof: code trace (no jsdom); `useNotebookEntries.reloadEntry`.

#### C-03 fixed
CommandPalette navigates to `notebookEntryPath(id)` (`?entry=` deep link, reactive, fetches the current entry). sessionStorage hand-off removed; `lib/pendingNotebookEntry.ts` now only clears a leftover snapshot on Notebook mount. Proof: code trace; tsc.

#### C-04 fixed
New `patchEntry(id, latest => ...)` in useNotebookEntries; photo/attachment upload and delete in Notebook.tsx use it (always from the latest cached entry, never the closure). Proof: code trace.

#### C-06 fixed
`useEntryAutosave` unmount flush reports failure via `onLeaveSaveFailed`; the editor stores the payload in sessionStorage (`pmaxing:notebook-unsaved:<entryId>`, new `lib/unsavedEntryDrafts.ts`) and shows an error toast. Reopening the entry shows "Restore them" / "Discard". Restore saves with the current base and remounts the editor. User action: document the new sessionStorage key in the cookie/storage notice if that list covers sessionStorage.

#### C-08 fixed
`removeFromStorageBestEffort` reads `{ error }` from storage-js. Test: notebook.service.silent-audit.spec.ts passes.

#### C-11 fixed
Editor payload sends `classNumber: null` when cleared or not CLASS (types updated: entryTypes.ts, UpdateNotebookEntryPayload). Backend DTO already accepts null (IsOptional). Proof: tsc + code trace.

#### C-12 fixed
useEntryShare loads requests/proposals whenever a share token exists (also on visibility change and live refresh); NotebookEntryShare shows them on a PUBLIC share when something is pending (invite stays AUTHORIZED only).

#### C-13 (= F-12) fixed
useVersionedDoc: on unmount / key change, and on `pagehide`, a fire-and-forget save runs when status is dirty or error; `beforeunload` guard while dirty/saving/error/conflict. Conflict is never auto-saved. Proof: code trace (no jsdom).

#### C-14 fixed
New backend/src/common/display-name.util.ts (`pushDisplayName`, + spec); social friendRequest, notesRequested, notesGranted pushes fall back to the email local part.

#### C-15 fixed
Invite 409s carry `code` (`INVITE_CONFLICT_CODE`: INVITE_NEEDS_AUTHORIZED, INVITE_NOTE_FULL, INVITE_DECLINED_RECENTLY); spec asserts codes. ShareNoteWithFriend.tsx and useEntryShare.ts map them. New keys `friend.share.noteFull`, `friend.share.declinedRecently` (8 languages).

#### C-16 fixed
useNotebookEntries tracks when each entry's URLs were signed; while an entry is open it checks every 60 s and on tab visible, and after 50 min refetches only photos/attachments (text and version untouched). Round 2: SharedNotebookEntry.tsx reloads the entry silently once the copy is 50 min old (checked every 60 s via useLiveRefresh; never on every focus, since each read records a visit). SharedEntryEditForm keeps the base version from when it opened, so a background refresh cannot bypass the 409.

#### C-07 fixed (round 2)
NotesAccessPanel starts the picker only with subjects still offered (new `lib/notesAccess.ts` `selectableGrantAreaIds`); failures now toast (see C-10). Test: frontend/src/lib/notesAccess.test.ts.

#### C-09 fixed (round 2)
useConfirmDelete takes `onError` (editor toasts `notebook.deleteError`); useFileUpload gets `handleRemove` + `removeFailureMessage`, used by photo/attachment remove (error shown in the section); NotebookScheduleLink remove catches and shows `notebook.scheduleLink.removeError`. Proof: code trace + tsc (no jsdom).

#### C-10 fixed (round 2)
useSocial and useNotesAccess `run` show an error toast (`social.actionError`) on failure; useNotesAccess exposes `hasError` when the first load fails and the Requests tab shows `social.notes.loadError` instead of "nothing waiting"; FriendProfile askNotes and remove/block catch and toast. Proof: code trace.

#### C-17 partial (round 2)
Social "Shared with me" and "My shares" show `social.listLimit` ("Showing the most recent 100") when the list reaches the backend cap. Left: no pagination; Notebook share badges for notes past the 100th, friend notes (300), view-grant lists (200) and turma linked areas (200) still cut silently (high caps, product decision on pagination).

#### C-18 fixed (round 2)
useVersionedDoc takes `onForbidden`: a 403 on save calls it. usePad reloads the lock meta (editor becomes read-only, shows "locked by someone else", typed text stays visible); TurmaNote reloads the turma (canEditNotes false, read-only). Proof: code trace.

Round 2 checks: frontend `tsc -b --noEmit`, `oxlint src`, `check-i18n` (0 problems), `vitest run src/components/Notebook src/lib src/hooks` (101 passed) + notesAccess test. Backend not touched in round 2.

#### Files changed / created
Backend: src/notebook/notebook.service.ts, notebook-collab.service.ts, notebook-invite.service.ts, notebook-invite.service.spec.ts, notebook-view-grant.service.ts, dto/upsert-notebook-entry.dto.ts, dto/shared-edit.dto.ts, src/social/social.service.ts; new src/common/display-name.util.ts, display-name.util.spec.ts, src/notebook/notebook-entry-concurrency.spec.ts.
Frontend: src/api/notebookService.ts, src/types/models.ts, src/hooks/useNotebookEntries.ts, useEntryAutosave.ts, useEntryShare.ts, useVersionedDoc.ts, src/components/Notebook/NotebookEntryEditor.tsx, NotebookEntryShare.tsx, SharedEntryEditForm.tsx, entry/entryTypes.ts, src/components/Social/ShareNoteWithFriend.tsx, src/components/CommandPalette/CommandPalette.tsx (small edit, shared file), src/pages/Notebook.tsx, SharedNotebookEntry.tsx, src/lib/pendingNotebookEntry.ts (rewritten to a cleanup helper); new src/lib/notebookEntryConflict.ts, notebookEntryConflict.test.ts, unsavedEntryDrafts.ts; i18n {8 langs}/social.ts, notebook.ts, share.ts.
Round 2 frontend: src/hooks/useSocial.ts, useNotesAccess.ts, useConfirmDelete.ts, useFileUpload.ts, usePad.ts, useTurmas.ts, useVersionedDoc.ts, src/components/Social/NotesAccessPanel.tsx, src/components/Notebook/entry/EntryFilesSection.tsx, NotebookScheduleLink.tsx, NotebookEntryEditor.tsx, SharedEntryEditForm.tsx, src/pages/Social.tsx, FriendProfile.tsx, TurmaNote.tsx, SharedNotebookEntry.tsx; new src/lib/notesAccess.ts, notesAccess.test.ts; i18n {8 langs}/social.ts, notebook.ts.

### Área d
### Fix log area d (rounds 1-2)

Checks run at end of round: backend `npx tsc --noEmit` clean, eslint clean on changed files (--fix only on the two test files), `npx jest src/wellbeing src/push src/reminders` 65/65. Frontend `npx tsc -b --noEmit` clean, oxlint clean on changed files, check-i18n 0 problems, `npx vitest run src/pwa src/hooks/usePushNotifications.test.ts` 21/21.

#### D-01 fixed (Critical)
- `backend/src/wellbeing/medications.service.ts`: sendDueReminders now does a second pass on yesterday's slots (nowMinutes + 1440, yesterday's date on the dose row) when nowMinutes < MEDICATION_REMINDER_WINDOW_MINUTES. A 23:50 dose is reminded at the 00:00 run; delayed cron runs inside the 60 min window still catch it. Query split into findReminderCandidates(date).
- Tests: `medications.silent-audit.spec.ts` (describe renamed to "regression"): original D-01 test plus once-only, yesterday date, delayed run (23:15 then 00:25), window expired (00:55), taken yesterday not reminded, summer time (UTC+1), 00:00 dose, no device retry.
- Known limit: if at 00:10 the user ticks "23:50" in the new day's checklist, that writes today's slot, so yesterday's 23:50 reminder can still fire at 00:15 (push text already says to check before taking).

#### D-02 fixed (Critical)
- Same file: dose filter is now `date AND (takenAt not null OR remindedAt not null)`. markReminded uses upsert per dose (not createMany skipDuplicates) so an existing untick row gets remindedAt; otherwise the reminder repeated every 15 min.
- Tests: original D-02 test, "after untick fires once across 5 runs", "ticked dose not reminded".

#### D-03 fixed
- `frontend/public/push-sw.js`: `renotify: Boolean(tag)`. Test `frontend/src/pwa/pushSw.test.ts` + original silent-audit test.

#### D-04 fixed
- `frontend/src/lib/focusAlerts.ts`: `renotify: true` in both SW and constructor paths (AlertOptions type). Test: silent-audit D-04.

#### D-06 (+F-03) fixed
- `frontend/src/hooks/usePushNotifications.ts`: new `unsubscribeThisDevice()` (POST /push/unsubscribe, then browser unsubscribe even if the API fails) and `syncPushSubscription(userId, lang, force)` (re-POST existing subscription, deduped per user|endpoint|lang). Re-sync moves the backend row to the logged-in account, so a subscription bound to another account is repaired.
- `frontend/src/context/AuthContext.tsx` (small edit, not owned by any area): logout calls unsubscribeThisDevice first (best effort) and clears the push prompt flag so the user is asked again next login (`pwa/pushPromptStorage.ts` clearPushPromptAnswered).
- New `frontend/src/pwa/PushSubscriptionSync.tsx`, mounted once in `routes/AppRouter.tsx`.
- Backend logout (auth.controller, area e) not changed: not needed since the client deletes the row; dead endpoints are deleted on 410.
- Tests: `frontend/src/hooks/usePushNotifications.test.ts`.

#### D-07 fixed
- push-sw.js: `pushsubscriptionchange` handler resubscribes with the old applicationServerKey (unless the browser gave newSubscription) and posts `pmaxing-push-resync` to windows; PushSubscriptionSync force re-posts. App open always re-syncs (SW has no CSRF token, so the app does the POST). Tests in pushSw.test.ts and usePushNotifications.test.ts.

#### D-08 fixed
- Backend: `GET /push/status` -> `{ configured, devices }` (push.controller.ts, PushService.getStatus, scoped by userId). Tests in push.service.spec.ts.
- Frontend: `api/pushService.ts` getPushStatus, `hooks/usePushDeviceStatus.ts`, `components/Wellbeing/MedicationPushWarning.tsx` mounted in MedicationsCard when any active daily med has reminders: warns when 0 devices or push not configured, with Enable button (or blocked/unsupported hint incl. iPhone Home Screen). i18n keys `wellbeing.meds.push.*` in meds.ts x8.
- Manual check: open /wellbeing with reminders on and no device, see warning; press Turn on notifications, warning goes away.

#### D-09 fixed
- `backend/src/push/push.service.ts`: per-key TTL (medication 60 min = reminder window, rest 24 h), `sentAt` in payload; push-sw.js uses sentAt as timestamp (ignored if invalid or in the future). Tests: `backend/src/push/push.delivery.spec.ts`, push.service.spec.ts, pushSw.test.ts.

#### D-11 (+F-08) fixed
- PushSubscriptionSync re-runs on `lang` change; the dedupe key includes lang, so the subscription is re-posted with the new language. Test in usePushNotifications.test.ts.

#### D-10 fixed (round 2)
- New `frontend/src/lib/appTimeZone.ts` deviceMatchesAppTimeZone() (compares wall clock with APP_TIME_ZONE, so London/Madeira count as equal). `MedicationForm.tsx` always shows `wellbeing.meds.timesZone` under the times, plus amber `wellbeing.meds.timesZoneDiffers` when the device clock differs. Quiet-hours note is area e.
- Test: `frontend/src/lib/appTimeZone.test.ts`.

#### D-12 partial (round 2)
- Deadline reminder email is now localised (subject, title, button, footer, dueLabel incl. date locale) in 8 languages. New `backend/src/mail/mail-messages.ts`; `mail.service.ts` sendDeadlineReminderEmail takes `lang`; `reminders.service.ts` reads the language from the user's newest PushSubscription.lang (User has no language column), English fallback.
- Tests: `backend/src/mail/mail-messages.spec.ts`, 2 new tests in `reminders.service.spec.ts`.
- Left (partial): reset password, verification and password-link emails stay English. They are sent without a session (password link is triggered by whoever tries to register with that email), so there is no trustworthy language; a proper fix needs a `User.language` column (schema change, not done). Proposed: add `language String @default("en") @db.VarChar(10)` to User, save it on language change, then `npx prisma migrate dev --name user_language`.

#### Not mine
- D-05 done by area f.

#### Round 2 checks
Backend: tsc clean; eslint clean on changed files (--fix used on mail-messages.ts/spec, reminders.service.ts, reminders spec: only my lines); jest mail/reminders/push/wellbeing 70/70. Frontend: tsc -b clean, oxlint clean, check-i18n 0 problems, appTimeZone test 2/2.

### Área e
### Fix log, area e

Status: all 15 assigned IDs done. Fixed: E-01, E-02, E-04, E-05, E-06, E-07, E-09, E-10, E-11, E-12, E-13, E-14, E-15. Partial: E-08 (user column), E-16 (server-side suspension date). E-04 binary rebuilt again in round 2 so it includes E-13.

#### E-01 Email case: fixed
- New `backend/src/auth/email.util.ts`: `normalizeEmail` (trim + lower), `@NormalizeEmail()` class-transformer decorator, `emailEquals()` Prisma insensitive filter.
- DTOs normalise email: login, register, forgot-password, resend-verification (`dto/login.dto.ts`, `register.dto.ts`, `forgot-password.dto.ts`, `verify-email.dto.ts`).
- `password-auth.service.ts` syncLocalUser: looks up by `supabaseAuthId` first (exact link, covers old case-only duplicates), then insensitive email (oldest first); new rows stored lowercase. Register/forgot lookups use `emailEquals` + `orderBy createdAt asc`.
- `oauth-identity.service.ts` resolveIdentity: normalises the provider email once (covers Google/GitHub/Discord), merge and conflict lookups are case-insensitive.
- Existing rows are NOT rewritten.
- Tests: `password-auth.email-case.silent-audit.spec.ts` (now passes), new `backend/src/auth/email.util.spec.ts`.
- User action, suggested one-off data check for existing duplicates (read-only):
  `SELECT lower(email) AS email, count(*), array_agg(id ORDER BY "createdAt") FROM "User" GROUP BY lower(email) HAVING count(*) > 1;`
  Any hit needs a manual merge decision; optional later: a citext column or a unique index on lower(email) (schema change, not done).

#### E-02 Password reset revokes sessions: fixed
- New public endpoint `POST /auth/reset-password` (throttle 5/min, `CompletePasswordResetDto` in `dto/password-link.dto.ts`): body `{ accessToken, password }`.
- `PasswordAuthService.completePasswordReset`: validates the Supabase recovery access token server-side (`admin.auth.getUser(token)`), updates the password via `admin.updateUserById`, returns the local user id (by supabaseAuthId). Invalid token -> 400 `{ code: 'RESET_LINK_INVALID' }` (400, not 401, so the global 401 redirect in client.ts does not fire).
- `AuthService.completePasswordReset` then calls `revokeAllSessions` (tokenVersion bump).
- Frontend `ResetPassword.tsx` no longer calls `supabase.auth.updateUser`; it sends the session token to the new endpoint (`completePasswordResetRequest` in `api/userService.ts`); invalid link shows the existing "link expired" screen; other errors show the translated `auth.reset.error` (also removes the raw Supabase English text, part of E-16).
- Note: no `amr`/recovery-claim check; any valid Supabase access token for the user is accepted. Safe because the browser never receives Supabase tokens except via the recovery link (password login is server-side).
- Tests: new `backend/src/auth/services/password-auth.reset.spec.ts`, `backend/src/auth/auth.service.spec.ts` (revocation).
- Deploy: backend and frontend must ship together (old frontend keeps working, just without revocation).

#### E-04 Pre-configured agent download: fixed
- Rebuilt `frontend/public/downloads/pmaxing-agent.exe` from current `agent/` (includes E-12 and E-15 fixes):
  `GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -H=windowsgui" -o pmaxing-agent.exe .` (run in agent/). Verified: amd64, GUI subsystem, requireAdministrator manifest present, V2 START/END markers present, V1 absent. Not run (cannot execute on this machine).
- `DownloadSetupButton.tsx`: fetches the .exe first, checks it contains the V2 marker (`exeSupportsEmbeddedConfig`), and only then creates the API key, so failed clicks no longer leave orphan keys. Markers moved to `lib/agentConstants.ts`.
- Test: new `frontend/src/lib/agentConstants.test.ts`.
- User: commit the new binary; rebuild it whenever agent/ changes (README "Build" section omits `-H=windowsgui`; main.go says the distribution build uses it). A CI marker check was not added.

#### E-05 Clearing commute / addresses / quiet hours: fixed
- `CommuteSettingsCard.tsx` sends `null` for cleared commute minutes, addresses and both quiet hours; "Saved." now `t('ui.saved')`; short note `ui.quietHoursLisbonNote` under the quiet-hours inputs (D-10), added in all 8 `extra.ts`.
- Backend `update-profile.dto.ts` types accept `null` (@IsOptional already lets null pass); `auth.service.ts` updateProfile writes null for those five nullable columns and ignores null on non-nullable ones (booleans, commuteMode) instead of a Prisma 500. `api/userService.ts` types updated.
- Test: `backend/src/auth/auth.service.spec.ts` (updateProfile).

#### E-06 Blocked account via OAuth: fixed
- `oauth-conflict-redirect.filter.ts`: ACCOUNT_BLOCKED with appealToken -> redirect `/auth/callback?error=account_blocked#appeal=<token>` (fragment, never sent to servers).
- `AuthCallback.tsx`: reads and clears the fragment, renders `AccountBlockedPage` with the bearer token (same as password login); no token -> generic error.
- Test: new `backend/src/auth/filters/oauth-conflict-redirect.filter.spec.ts`.

#### E-10 Password success message wiped: fixed
- `EditProfileModal.tsx` reset effect depends on `[isOpen, user.id]` instead of `[isOpen, user]`.
- Test: none (frontend has no DOM test setup). Manual check: Profile > Edit > change password; the success text must stay.

#### E-12 Agent date-only tasks overdue on due day: fixed
- `agent/internal/rules/rules.go`: `deadlineOf` treats UTC-midnight dates as due at +24h (mirrors frontend isUtcMidnight).
- Test: `agent/internal/rules/silent_audit_test.go`. Could NOT run: Application Control blocks the compiled test exe in every folder tried (scratchpad gotmp and a folder inside the repo, removed). `go vet ./...` passes. User: run `go test ./...` in agent/ on a machine where test binaries can run.

#### E-15 Process kills not verified / names without .exe: fixed (in the agent, not the UI)
- `agent/internal/blocker/process_windows.go`: `normalizeProcessName` appends `.exe` when there is no extension (before the protected/self checks); taskkill exit code checked, failures logged and not reported as killed.
- Test: `TestNormalizeProcessName` in `process_windows_test.go` (same run limitation as E-12).

#### E-07 Security logs lose 429s / stats count rows: fixed
- `backend/src/common/guards/logging-throttler.guard.ts`: when buckets are pending, a timer (unref'd, `OnModuleDestroy` flushes) writes them all after 5s, so no other 429 for the same key is needed. Stale `lastFlush` keys are pruned, so the two Maps stop growing without limit.
- `backend/src/security-logs/security-logs.service.ts` getStats sums `count` (`aggregate`/`groupBy _sum`) and does not count rows.
- `SecurityLogRow.tsx` shows `xN` when a row aggregates more than one request. `count` added to the `SecurityLog` type in `types/models.ts`.
- Tests: `logging-throttler.guard.silent-audit.spec.ts` now passes. The test was corrected only to use fake timers and advance 5s before asserting: the 5s aggregation is intentional (protects the DB pool), and the bug was that the rest of the burst was never written. New `backend/src/security-logs/security-logs.service.spec.ts`.

#### E-08 Admin pad rows as rate-limit blocks; user always anonymous: partial
- Stats only count `RATE_LIMIT_EXCEEDED` rows, so the admin's own IP no longer shows as a top offender. The table labels pad-moderation rows (`ui.securityTypeAdminPad*`).
- Left: the global throttler runs before auth guards, so `req.user` is never set and 429 rows stay "anonymous". Fixing it means decoding the session cookie inside the throttler. Not done: it needs a design decision (cost on every blocked request).
- Test: covered by `security-logs.service.spec.ts` (type filter).

#### E-09 Data export incomplete: fixed
- `backend/src/users/users.service.ts` exportUserData now also exports:
  - profile settings (commute, addresses, quiet hours, reminders, status, friend code, active program/period, 2FA enabled date, medication disclaimer)
  - work shifts, commitments, class occurrences, grade components + entries, academic periods (inside programs), travel times
  - task packs + items
  - social: friendships, blocks, notes view grants
  - notebook shares (no token), feedback, appeals
  - agent config, push subscriptions (id/lang/createdAt only, no endpoint or keys)
  - areas owned by the user even when unused
- Secrets stay out (2FA secret/hashes, feed token, supabaseAuthId, share tokens, push keys).
- Test: new `backend/src/users/users.export.spec.ts`.
- User: consider whether the Privacy Policy describes the export contents.

#### E-11 Developer/Agent load and create errors: fixed
- `hooks/useApiKeys.ts`: `loadError`, `createError`, and `createKey` returns a boolean.
- `pages/Developer.tsx`: shows `ui.couldNotLoadApiKeys` instead of the "no keys" empty state, and `ui.couldNotCreateApiKey` under the form (input kept on failure).
- `hooks/useAgentConfig.ts` + `pages/Agent.tsx`: `loadError` shows `ui.couldNotLoadAgentConfig` instead of an endless skeleton.
- Test: none (no DOM test setup). Manual check: block the API in devtools and open /developer and /agent.

#### E-13 Revoked key keeps blocking: fixed
- `agent/internal/apiclient`: new `ErrUnauthorized`, wrapped (`%w`) by the 401 paths in `client.go` and `agentconfig.go`.
- `agent/main.go`: on a 401 from config or tasks, `stopForRevokedKey` sets the decision to "not blocking", removes the blocks via `applyDecision`, and puts the reason ("API key invalid or revoked - download the agent again from the /agent page") in the tray's View status.
- Test: new `agent/internal/apiclient/unauthorized_test.go` (httptest TLS 401 gives ErrUnauthorized). `go test ./...` is blocked by Application Control here; main session to run it. `go vet ./...` is clean.

#### E-14 Admin queues silently capped: fixed (warning, no pagination)
- `FeedbackAdmin.tsx` and `FriendCodeRequestsAdmin.tsx` show `ui.adminListCapped` when the list reaches the backend cap (`FEEDBACK_LIST_LIMIT=300` in `api/feedbackService.ts`, `FRIEND_CODE_QUEUE_LIMIT=200` in `api/socialService.ts`, matching the `take` values). Comments link the two sides in `feedback.service.ts` and `friend-code-requests.service.ts` (comment-only edit in area c's file).
- Real pagination is left for later.

#### E-16 Minor auth UX swallows: partial
- `Login.tsx`: 429 shows `auth.tooManyAttempts`; network or 5xx shows `auth.serverUnavailable`; 401 keeps the old message.
- `Register.tsx`: client-side 8-character check; 409 shows `auth.accountExists`; 429 shows `auth.tooManyAttempts`.
- ResetPassword raw Supabase text: removed in E-02.
- Document titles of Profile/Agent/Developer now go through `t()`.
- Left: the suspension message date is still formatted on the server (`account-guard.service.ts`). AccountBlockedPage replaces it as soon as the status endpoint returns its own locally formatted date, so the impact is a brief flash.
- New i18n keys in all 8 `auth.ts`.

#### Checks run
- backend: `npx jest src/auth src/security-logs src/common/guards src/users src/feedback src/social` 18 suites / 75 tests pass; `npx tsc --noEmit` clean; eslint clean on changed files.
- frontend: `tsc -b --noEmit` clean; oxlint clean on changed files; check-i18n shows no issue for the new keys; vitest agentConstants pass.
- agent: `go vet ./...` clean; `go test ./...` blocked by Application Control (main session to run). Binary rebuilt with the same command as E-04; V2 markers verified.

### Área f

All paths relative to D:\Productivity_Maxing. No schema change, no migration. Nothing committed.

#### F-09 Three different "today"s: fixed
- Rule now documented at the top of `frontend/src/lib/dateKey.ts`:
  1. `todayKey()` = the browser-local calendar day (all UI "today": form defaults, "Today" reschedule, task status, schedule).
  2. `lisbonTodayKey()` / `toLisbonDateKey()` = Lisbon day, only for data the backend keys by Lisbon day (meds, mood, study daily totals).
  3. `toDateKey(date)` = UTC slice, only for UTC-anchored dates (date-only tasks, schedule days).
  New helpers: `toLocalDateKey`, `taskDayKey`, `APP_TIME_ZONE`.
- `utils/taskDateStatus.ts` getDateStatus compares `taskDayKey(task.date)` with the local today (date-only tasks by stored day, timed tasks by local day).
- Callers: `components/Dashboard/StudyActivityCard.tsx` (Lisbon key, backend totals are Lisbon), `components/Study/focus/SessionForm.tsx` and `components/Dashboard/OnboardingChecklist.tsx` (were UTC, now local). Other todayKey() callers become local automatically.
- Tests: `lib/dateKey.silent-audit.test.ts` (4 pass). Test 4 corrected: it described a UTC-3 user but ran with TZ=Europe/Lisbon, where 02:30 on 24 Oct genuinely makes a task due on the 23rd overdue; it now sets TZ=America/Sao_Paulo. New `lib/dateKey.test.ts`.

#### D-05 Wellbeing day = Lisbon, not frozen: fixed
- New `frontend/src/hooks/useLisbonToday.ts`: Lisbon day key, re-checked on visibilitychange, window focus, and every minute while visible.
- `hooks/useMedications.ts`, `hooks/useMoodToday.ts` use it (reload when the day changes; mood clears yesterday's log). `components/Wellbeing/MoodCheckInCard.tsx` resets its fields on a new day.
- Test: `pwa/notifications.silent-audit.test.ts` (area d file, smallest edit): the D-05 assertion now checks `lisbonTodayKey()`, the helper the hooks use (todayKey is intentionally local now). `lib/dateKey.test.ts` covers Lisbon key under a Tokyo browser.
- Not done (optional from the report): a visible date label on the checklist.
- Manual check: leave /wellbeing open past Lisbon midnight, return to the tab: checklist reloads for the new day.

#### C-05 Notebook new entries use the local day: fixed
- `components/Notebook/entry/notebookEntryConfig.ts`: `toDateInputValue` uses local getters; new `newEntryDateIso()` (local noon). `pages/Notebook.tsx` creates entries with it.
- Test: `components/Notebook/entry/notebookEntryDate.silent-audit.test.ts` (2 original pass + new UTC+13 round-trip case).
- Left: backend search date formatting in server UTC (notebook.service.ts:1250, area c).

#### B-09 "+1 Day"/swipe keeps date-only tasks date-only: fixed
- New `tomorrowForTask()` in `frontend/src/lib/weekDates.ts`: date-only stays UTC midnight of local tomorrow; timed keeps its local time. `hooks/useQuickReschedule.ts` uses it.
- Test: `lib/dateKey.test.ts` (tomorrowForTask, 3 cases incl. 00:30 Lisbon).

#### E-03 (= F-02) Wrong 2FA code stays on /login/2fa: fixed
- `frontend/src/api/client.ts`: 401 from `/auth/login` and `/auth/2fa/login` no longer triggers the global logout redirect; TwoFactorCodeForm shows the error.
- Test: `api/client.auth-redirect.silent-audit.test.ts` passes.

#### F-05 CSRF retry into another account: fixed
- Backend `backend/src/auth/auth.controller.ts` (area e, one-line edit): `/auth/csrf` also returns `userId` (the session's own id).
- `frontend/src/api/csrfStore.ts`: `setSessionUserId/getSessionUserId`; `context/AuthContext.tsx` sets it from the loaded user.
- `api/client.ts`: on 403 CSRF, if the refreshed session belongs to another user, the write is NOT replayed and the tab reloads. Old backend without userId keeps the old behaviour.
- Test: new `api/client.csrf-account.test.ts` (same account replays once; other account no replay + reload).
- Deploy: backend and frontend (frontend works with either backend).

#### F-06 i18n English copies + check: fixed
- Translated 141 keys (fase7.ts 133, meds.ts 8) in pt/es/fr/de/ja/ko/zh, plus ja `footer.rights`. (The report said ~78; the stricter check found 141.)
- `frontend/scripts/check-i18n.mjs` now flags values identical to English (multi-word values only), with allowlists: values (brand names, `EULA (Agent)` in de) and keys (`ui.teacherProfessor`, `ui.holidayExam` import placeholders, `ui.userAgent`). Result: 2568 keys, 0 problems.
- Translations are machine-quality; a native review of ja/ko/zh is advisable.

#### F-07 (incl. a-09) Transient failures cached / caches survive logout: fixed
- `hooks/useCalendarStatus.ts`: errors no longer cache `false`; retry on next mount, focus, or visibility; new `resetCalendarStatus()`; `fetchStatus` exported for tests.
- `context/AuthContext.tsx`: resets the calendar cache on login and logout.
- `components/CommandPalette/CommandPalette.tsx`: task/area fetch failures are retried on the next open; lists are refetched when the user changes.
- Test: new `hooks/useCalendarStatus.test.ts`.
- Not covered by a test: palette retry (no jsdom).

#### F-10 Offline app shell: fixed (real fix)
- `frontend/vite.config.ts`: new runtime route for same-origin navigations (NetworkFirst, cache `pmaxing-app-shell`, one entry under key '/', status 200 only, no network timeout so online always gets the fresh index.html). /privacy and /terms excluded (own static HTML). API stays NetworkOnly (other origin; /auth/ matched earlier).
- `pwa/OfflineBanner.tsx` comment corrected.
- Verified with a scratch `vite build` (output in scratchpad, deleted): sw.js contains the NetworkFirst navigation route.
- Manual check after deploy: install the PWA, open once online, go offline, reload: app opens with the offline banner. Limitation: offline right after a deploy, before any online visit, the cached HTML may reference old chunks (ErrorBoundary reload screen).

#### Checks
- vitest: src/lib, src/api, src/hooks, src/utils, src/components/Notebook/entry, src/pwa: 36 files, 148 tests pass.
- `node scripts/check-i18n.mjs`: 0 problems. `npx oxlint`: clean.
- `npx tsc -b --noEmit`: 2 errors, both in area c work in progress (NotebookEntryEditor.tsx classNumber type, lib/notebookEntryConflict.ts erasableSyntaxOnly), not from these changes.
- backend `npx tsc --noEmit`: 0 errors; eslint auth.controller.ts clean.
