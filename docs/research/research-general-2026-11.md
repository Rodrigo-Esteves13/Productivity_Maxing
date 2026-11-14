# Pesquisa: produtividade geral, foco, hábitos, bem-estar, dinheiro, social, PWA, agente (14/11/2026)

Âmbito: ideias NOVAS. Cruzadas com `docs/research/pmaxing_ideias_atualizado(7).txt` (v7 + v6 completa, N1-N73), `docs/research/feature-research-2026-11.md`, `frontend/src/lib/changelog.ts` e grep ao repo. Fica de fora tudo o que já existe ou já está na lista. Isso inclui o plano diário e o fecho (N60), o PiP (N50), focar com amigos (N66), o quadro semanal (N73), o habit tracker (N65), o sono (N68), o "sai até" no dia do exame (N69), o brain dump (N53), o tray do agente (N33), a notificação persistente (N34), a pausa negociada (v6) e o modo exame.

Restrições respeitadas: sem IA paga, sem o servidor ir buscar URLs do utilizador, sem bancos, sem emoji, sem verde, reaproveitar dados.

Ordem: valor / esforço (o melhor primeiro).

---

## 1. Tarefas para a energia de agora
- Pitch: com a energia do check-in de hoje (1-5), o cartão Hoje e o modo single task propõem primeiro tarefas de esforço compatível: energia baixa dá LIGHT/MODERATE curtas, energia alta dá HEAVY/EXHAUSTIVE.
- Evidência: o Structured tem o "Energy Monitor" na versão grátis (revisão habitbox.app 2026, listagem da App Store id1499198946). Os guias de ADHD juntam a estimativa de tempo com "energy accounting" (podcast ADHD-ish sobre o Goblin Tools: o estimador só mede tempo e por isso recomendam juntar-lhe a energia). O Tiimo, iPhone App of the Year 2025, organiza o dia pela capacidade e não só pela lista.
- Builds on: `MoodLog.energy` (`hooks/useMoodToday.ts`, `Wellbeing/MoodCheckInCard.tsx`), `Task.effort` (enum `Effort` LIGHT..EXHAUSTIVE), `Task.estimatedMinutes`, `lib/mostUrgentTask.ts`, `Dashboard/SingleTaskView.tsx`, `Dashboard/TodayCard.tsx`, `lib/taskReadinessFilter.ts` (já filtra por esforço). Verificado: `energy` não aparece em nenhum componente de tasks.
- Esforço: S. Migração: não. Sem check-in hoje, a ordem fica como está. Um chip "a pensar na tua energia (2/5)" explica a escolha.

## 2. Quanto podes gastar por dia
- Pitch: em Money e no MoneySnapshotCard aparece "Podes gastar 8,40 EUR/dia até ao fim do mês", que é o limite mensal (ou o de lazer) menos o já gasto e as despesas recorrentes que ainda vão cair, a dividir pelos dias que faltam.
- Evidência: o "Safe to Spend" do Rocket Money (atualiza com contas pagas e salários, tem widget) e o "In My Pocket" do PocketGuard (descontam contas, poupança e o essencial). Ambos são citados nas listas de apps para estudantes.
- Builds on: `FinanceSettings.monthlyBudgetCents` e `leisureBudgetCents`, `Finance/FinanceOverview.tsx` (`BudgetLine`), `lib/financeSchedule.ts` (ocorrências projetadas), `lib/moneySnapshot.ts`, `Dashboard/MoneySnapshotCard.tsx`. Verificado: não há `perDay`, `safeToSpend` nem `runway` em finance.
- Esforço: S. Migração: não. Função pura com testes (fim de mês, limite ultrapassado, dia 31). Respeita o modo privacidade (`PrivateText`).

## 3. Caixa de distrações no Focus
- Pitch: o botão "Got distracted" ganha um campo opcional para escrever o pensamento intrusivo ("responder ao X", "ver preço do passe"). Fica numa nota pessoal "Durante o foco", para tratares depois sem saíres da sessão.
- Evidência: o Structured guarda ideias na inbox para "tirar da cabeça sem as perder" (citação de um utilizador com ADHD na App Store). O one sec mostra que travar o impulso funciona: estudo na PNAS em 2023 com -57% de uso das apps, embora coassinado pelo próprio criador. É a técnica de "distraction list" dos guias de ADHD.
- Builds on: `Study/focus/DistractionButton.tsx` (`recordDistraction`, já otimista), `StudySession.distractionCount`, o módulo `backend/src/personal-notes` + `hooks/usePersonalNotes.ts`, e mais tarde o N53 (nota para task). Verificado: o botão hoje só conta e não guarda texto.
- Esforço: S. Migração: não (usa PersonalNote). A nota liga-se à sessão pelo título com a data. Nunca entra nas estatísticas partilhadas.

## 4. Começar só 5 minutos
- Pitch: um botão "Só 5 min" em cada task (cartão, single task, Hoje) abre uma sessão de Focus de 5 minutos já ligada à task. No fim, "continuar 20 min" ou "parar, já comecei". Serve para o bloqueio de arranque.
- Evidência: o Focus Friend (Hank Green, nº1 da App Store dos EUA em agosto de 2025) aceita sessões a partir de 5 min. O Llama Life põe um temporizador por task contra a cegueira temporal. O TickTick 6.4.10 (outubro de 2025) passou a somar o tempo extra depois do fim do bloco.
- Builds on: `lib/focusTimer.ts` (`MIN_FOCUS_MINUTES = 5`, `TIMER_PRESETS` 25/50/90), `Study/focus/TimerEndPrompt.tsx` (já tem "Keep going"), `StudySession.taskId`, `context/StudySessionProvider.tsx`, `Dashboard/SingleTaskView.tsx`.
- Esforço: S. Migração: não. Fica também no Ctrl+K como "Começar 5 min na task mais urgente" (`mostUrgentTask`).

## 5. Ecrã sempre ligado no Focus
- Pitch: com uma sessão de Focus a correr e o relógio visível, o telemóvel ou o tablet não apaga o ecrã (Screen Wake Lock). Há um toggle, ligado por omissão, e o lock é largado na pausa ou ao parar.
- Evidência: a Web Wake Lock API funciona em Chrome/Edge e no Safari 16.4+. As apps de foco no telemóvel (Forest, Focus Friend) contam com o telemóvel pousado e o ecrã ligado. Verificado: `wakeLock` não existe no repo.
- Builds on: `Study/focus/SessionClock.tsx`, `FocusModeOverlay.tsx`, `StudySessionProvider.tsx` (já ouve `visibilitychange`, que é onde o lock se volta a pedir).
- Esforço: S (cerca de 40 linhas + toggle em `useAccessibilityPrefs` ou nas prefs do Focus). Migração: não. Deteta o suporte e esconde o toggle quando não há.

## 6. Contador no ícone da app
- Pitch: o ícone da PWA instalada mostra o número de tasks para hoje e em atraso (Badging API). Atualiza ao abrir a app, ao completar uma task e no service worker quando chega um push de prazos.
- Evidência: a Badging API funciona em PWAs no ecrã principal do iOS/iPadOS 16.4+ (WebKit) e no desktop Chromium. O Streaks (Apple Design Award) acrescentou um filtro "Badge" para escolher o que conta no ícone. Verificado: `setAppBadge` não existe no repo.
- Builds on: `public/push-sw.js`, `hooks/useTodayOverview.ts` / `lib/todayOverview.ts`, `useCompleteWithUndo.ts`, `pwa/InstallAppCard.tsx`. Toggle e escolha (só hoje / hoje + atraso / nada) nas Preferences.
- Esforço: S. Migração: não (pref em localStorage). No Android o suporte é inconsistente (MDN e terceiros discordam), por isso deteta-se e falha em silêncio.

## 7. Hora prevista de fim
- Pitch: no cartão Hoje e no Focus aparece "Se começares agora, acabas por volta das 18:40". É a soma do tempo estimado das tasks de hoje que faltam, mais as aulas e turnos que ainda vêm, e fica a vermelho se passar da hora de dormir ou das quiet hours.
- Evidência: o Llama Life mostra o "estimated finishing time" da lista e o total de tempo, contra a cegueira temporal. O Tiimo baseia-se numa timeline visual pela mesma razão (revisões de 2025).
- Builds on: `Task.estimatedMinutes`, `hooks/useDurationPrediction.ts`, `Dashboard/TodayCard.tsx` (`dueToday`, `currentOrNextAgendaItem`), `Study/focus/DayProgressCard.tsx`, `User.quietHoursStart`. Verificado: não há `finishBy` nem `estimatedEnd`.
- Esforço: S. Migração: não. Tasks sem estimativa usam a previsão (`useDurationPrediction`) e são marcadas "aprox.".

## 8. Botões nas notificações: Feita e Amanhã
- Pitch: o push de prazos e o resumo do dia ganham botões de ação ("Marcar feita", "Passar para amanhã") que funcionam sem abrir a app, como o "Tomei" da medicação.
- Evidência: o padrão já está validado na app (botão "Tomei"). Os gestores de tarefas grandes (Todoist, TickTick) oferecem concluir e adiar a partir do lembrete no Android. Isto é conhecimento geral, não confirmado nesta pesquisa. Os lembretes sem passos extra são o pedido mais repetido nas revisões de planners para estudantes (Product Hunt).
- Builds on: `public/push-sw.js` (`DOSE_ACTION`, `actionToken`, `notificationclick`), `backend/src/push/push.service.ts` (`doseActionPayload`, `DOSE_ACTION_KEYS`), o token assinado de `wellbeing/medications.service.ts` (`doseActions.verify`), `reminders/due-today-reminders.service.ts`, `PATCH /tasks/bulk-reschedule` e `postponedCount`.
- Esforço: M. Migração: não. O token é de uso único, vale 24 h e fica ligado a userId + taskId, com rate limit. "Amanhã" usa o mesmo caminho do botão +1 Day, por isso conta como adiada.

## 9. Intenções da semana e recomeço
- Pitch: à segunda-feira, no 1º dia do mês e no início do semestre, um cartão "Novo começo" pede 1 a 3 intenções para a semana (texto livre ou ligadas a tasks). Na Weekly review, cada uma é marcada como feita, meio feita ou não.
- Evidência: o "fresh start effect" (Dai, Milkman e Riis, Management Science 2014, e Psychological Science 2015): os marcos temporais aumentam o início de objetivos, e as pessoas escolhem 3,5x mais um lembrete numa data que soa a "recomeço". O Sunsama lançou em 2026 o resumo semanal por email e planeamento semanal (changelog, abril de 2026). Verificado: a `pages/WeeklyReview.tsx` olha só para trás (completed, studied, pushedBack, comingUp) e não tem intenções.
- Builds on: `pages/WeeklyReview.tsx`, `Dashboard/GreetingBanner.tsx`, `WeeklyChallengeCard.tsx` (é auto-gerado, este é escolhido pela pessoa), `AcademicPeriod.startDate`, o padrão de localStorage de `useGreetingPrefs`.
- Esforço: S (v1 em localStorage). Migração: não na v1. Para sincronizar entre dispositivos: `WeeklyIntention { userId, weekKey, text, taskId?, outcome }`.

## 10. Modo estrito no Focus
- Pitch: uma opção por sessão em que sair do separador ou da app mais de 15 s conta sozinho como distração, e a sessão mostra "estiveste fora 6 min". Não é um castigo, é só honestidade nos números.
- Evidência: no Forest a árvore morre se sais. No Focus Friend o feijão "desmancha as malhas" se abres uma app bloqueada, e foi esse vídeo que tornou a app viral em 2025 (NBC News). O Opal tem um Deep Focus que não se cancela.
- Builds on: o `visibilitychange` de `context/StudySessionProvider.tsx`, `StudySession.distractionCount` + `recordDistraction`, `Study/focus/DistractionStatsCard.tsx`. O tempo fora pode ir para `StudySession.note` ou ficar só no cliente.
- Esforço: S. Migração: não (opcional `StudySession.awayMinutes Int?` para estatísticas). Limite: no desktop o alt-tab para outra janela não dispara `visibilitychange`, só a mudança de separador e o minimizar. O agente (`blockDuringFocus`) cobre o resto.

## 11. Despesas anuais em mensalidades
- Pitch: as despesas anuais (propinas, seguro, renovação do passe, licenças) aparecem como "põe de lado 42 EUR/mês" com quanto falta até à próxima. Há um botão para criar um objetivo de poupança com esse plano.
- Evidência: o YNAB chama-lhes "True Expenses" e sugere dividi-las por mês (sinking funds). O template de faculdade do YNAB vem com estes fundos (thecollegeinvestor, fincomparelab 2026).
- Builds on: `FinanceEntry.frequency = YEARLY`, `monthlyCostCents` em `finance/finance-analytics.util.ts` (hoje só usado nas subscrições), `FinanceGoal.monthlyPlanCents` + `finance-goal-plan.util.ts`, `Finance/FinanceAnalytics.tsx` (bloco das subscrições como modelo).
- Esforço: S. Migração: não. É diferente da ideia v6 "alerta de prazos de propinas", que é um lembrete e não um plano mensal.

## 12. Ctrl+K com recentes e ajuda de atalhos
- Pitch: o Ctrl+K abre com as 5 tasks, notas e páginas abertas há pouco. A tecla "?" mostra todos os atalhos, e passa a haver navegação "g" + letra (g t Tasks, g f Focus, g m Money).
- Evidência: o Akiflow é elogiado por ser "keyboard-first" com command bar (revisões de 2025). As revisões do Notion Calendar apontam-lhe a falta disso como fraqueza.
- Builds on: `CommandPalette/CommandPalette.tsx`, `lib/paletteActions.ts`, `lib/siteMap.ts`, `hooks/useTaskShortcuts.ts` (N/C/E/Del só em Tasks), o padrão localStorage de `lib/lastUsedArea.ts`. Verificado: não há "recent" no palette nem overlay de atalhos.
- Esforço: S. Migração: não. Os atalhos respeitam inputs com foco e há uma opção para os desligar (acessibilidade, WCAG 2.1.4).

## 13. Aviso antes do próximo bloco ou aula
- Pitch: um push opcional 10 min antes de um bloco de estudo do plano ("Bloco de Redes às 15:00, começar Focus?") e antes de uma aula ou turno. Ajuda nas transições, que são o ponto fraco de quem tem ADHD.
- Evidência: o Tiimo e o Structured vivem de lembretes na timeline contra a cegueira temporal (revisões ADHD 2025/2026). O Reclaim reserva "decompression time" e buffers entre eventos (help center).
- Builds on: `study-plan/study-plan.scheduler.ts` (blocos), `ClassOccurrence`, `WorkShift`, `reminders/*` + `SentNotification` (dedupe por bloco), `lib/pushKinds.ts` / `MUTABLE_PUSH_KINDS`, quiet hours, e o deep link para `/focus` com a task. Verificado: não há kind de aviso pré-bloco em `sent-notification.constants.ts`.
- Esforço: M. Migração: não (a pref é um kind no `mutedPushKinds`, desligado por omissão). A precisão depende da frequência do cron (ADR 0006). Os exames ficam com o N69.

## 14. Bloqueio por horário no agente
- Pitch: na página /agent passa a haver janelas fixas ("seg-sex 09:00-13:00", "todos os dias 00:30-07:00 dormir") em que o agente bloqueia, independentemente das tasks.
- Evidência: o Opal agenda "work hours, sleep e routines" (listagem da App Store, chegou ao Android em agosto de 2025). O Cold Turkey tem blocos agendados (getcoldturkey.com/features). Verificado: `AgentConfig` só tem regras por tasks e Focus, sem horas.
- Builds on: `AgentConfig` (schema), `backend/src/agent/agent-config.service.ts` + DTO, `agent/internal/rules/rules.go` (`Evaluate`, junta-se uma razão "inside scheduled window"), `agent/internal/apiclient/agentconfig.go`, `pages/Agent.tsx`, `lib/appTimeZone.ts` (hora de Lisboa).
- Esforço: M. Migração: sim (`AgentConfig.scheduleWindows Json @default("[]")` com `{days:int[], startMinutes, endMinutes}`, validado no DTO, máximo 10). O agente avalia com a hora local e com a decisão em cache se a API cair (`failMode`).

## 15. Streak e desafio com um amigo
- Pitch: convidas um amigo para uma streak a dois, que só sobe nos dias em que os dois estudam pelo menos X min. Há uma variante semanal: meta conjunta de minutos de foco. Mostra só sim/não por dia, nunca o que cada um estudou.
- Evidência: blog do Duolingo, "Friend Streak": quem tem pelo menos uma streak partilhada tem 22% mais probabilidade de fazer a lição do dia, com até 5 amigos e aceitação obrigatória. Os "Friends Quests" do Duolingo são metas semanais a dois. É diferente do N73 (quadro de todos) e do N66 (sessão ao vivo).
- Builds on: `Friendship` + `social/friendship.util.ts` (bloqueios), `getStudyStreak` / `study-sessions.service.ts`, `StreakFreeze` (o descanso de um conta como dia válido), push (`socialEvents.ts`), `Dashboard/WeeklyChallengeCard.tsx` (UI de progresso).
- Esforço: M. Migração: sim (`FriendStreak { id, userAId, userBId, minMinutes, startedOn, acceptedAt, endedAt }`, unique por par). O dia é calculado a partir das sessões, por isso não precisa de tabela de check-ins.

## 16. Próxima dádiva de sangue possível
- Pitch: o cartão de dádivas mostra "Podes voltar a doar a partir de 12/02" e quantas faltam no limite anual, com o intervalo à escolha (3 ou 4 meses, sangue total). Há um push opcional nesse dia.
- Evidência: em Portugal são 3 meses para homens e 4 para mulheres (Montepio 2025, guia UCP). A DECO Proteste fala de 2 meses com um máximo de 3 ou 4 dádivas por ano. Como as fontes divergem, o intervalo é escolhido pela pessoa, com nota "confirma no IPST / dador.pt". Verificado: `BloodDonationsCard.tsx` e `blood-donations.service.ts` não calculam a próxima data.
- Builds on: `BloodDonation` (`date`, `type`), `Wellbeing/BloodDonationsCard.tsx`, `wellbeing/blood-donations.service.ts`.
- Esforço: S. Migração: não para o cartão (intervalo em localStorage). O push precisa de `User.bloodDonationIntervalDays Int?`.

## 17. Pausa com fricção no agente
- Pitch: com o bloqueio ativo, podes pedir uma pausa de 5 a 15 min, mas primeiro tens de escrever uma frase aleatória e esperar 10 s a respirar, e há um máximo de N pausas por dia. Cada pausa fica registada.
- Evidência: o Cold Turkey obriga a escrever caracteres ou palavras aleatórias antes de uma pausa e tem "allowances" diárias (getcoldturkey.com, user guide). O one sec usa uma pausa a respirar (PNAS 2023). É diferente da "pausa negociada" da v6, que é um aviso antes de o bloqueio começar. Esta é pedida a meio do bloqueio.
- Builds on: `AgentConfig`, `agent/internal/rules/rules.go`, `pages/Agent.tsx`, `GET /agent/config` (o agente vê `breakUntil`).
- Esforço: M. Migração: sim (`AgentConfig.maxBreaksPerDay Int @default(0)`, `breakMinutes Int @default(10)`, `breakUntil DateTime?`). A frase é gerada e validada só na web: o agente limita-se a respeitar `breakUntil`.

## 18. Aviso de reposição de medicação
- Pitch: indicas quantas unidades tens e o limiar de aviso. Cada "Tomei" desconta uma, e um push avisa "restam 5 de X, renova a receita".
- Evidência: o Medisafe tem "Pills Left" com limiar configurável e lembrete diário até repor (help center Medisafe).
- Builds on: `Medication`, `MedicationDose.takenAt`, `MedicationIntake`, `reminders/medication-reminder-scheduler.service.ts`, a ação "Tomei" (`push-sw.js`), `Wellbeing/MedicationForm.tsx`, `MedicationDisclaimer.tsx` (mantém-se o aviso de que não é conselho médico).
- Esforço: M. Migração: sim (`Medication.stockCount Int?`, `refillThreshold Int?`, `refillRemindedAt DateTime?`).

## 19. Partilhar para a app
- Pitch: no Android, "Partilhar" a partir de qualquer app (um email, um link do Moodle, um texto) com a PWA instalada abre o quick add, ou uma nota, com o texto já preenchido.
- Evidência: o Web Share Target funciona no Chrome para Android desde 2019. No iOS Safari não funciona (WebKit bug 194593 ainda aberto, nota técnica de dezembro de 2025). O botão aparece só onde funciona.
- Builds on: o manifest em `frontend/vite.config.ts` (já tem `shortcuts`), `/tasks?new=1`, `lib/parseQuickAddTask.ts`, `pages/PersonalNotes.tsx`. Verificado: não há `share_target`.
- Esforço: S. Migração: não. Usa method GET, só `title`, `text` e `url` como texto, e nunca vai buscar o URL (não há SSRF).

## 20. Recuperar a streak com esforço extra
- Pitch: se a streak de estudo partiu nos últimos 2 dias e o descanso da semana já foi usado, estudar hoje o dobro do mínimo recupera-a. É uma recuperação ganha a trabalhar, não comprada.
- Evidência: o Duolingo tornou o Streak Repair grátis em troca de exercícios extra e trocou a receita pela retenção. Os guias de design de streaks recomendam a recuperação ganha (yukaichou.com, blakecrosley.com). Aos 7 dias de streak, a aversão à perda pesa (Lenny's Newsletter, PM de retenção do Duolingo).
- Builds on: `backend/src/study-sessions/streak-freezes.service.ts` (`FREEZE_MAX_DAYS_BACK = 1`, `FREEZE_MAX_PER_WEEK = 1`), `StreakFreeze`, `Study/StreakRestDayButton.tsx`, `reminders/streak-risk-reminders.service.ts`.
- Esforço: S/M. Migração: recomendada (`StreakFreeze.source String @default("REST")`, "REPAIR") para não gastar a quota de descanso nem confundir as estatísticas.

## 21. Custo em horas de trabalho
- Pitch: ao registar uma despesa, quem tem salário e turnos vê "isto equivale a 3,5 h de trabalho". É calculado do salário mensal a dividir pelas horas de turno do mês.
- Evidência: o conceito de "life energy" de "Your Money or Your Life" (Robin e Dominguez). Evidência de apps em 2025 fraca: entra pelo valor educativo para estudantes trabalhadores.
- Builds on: `FinanceEntry` INCOME recorrente (`Finance/FinanceSalaryFields.tsx`), `WorkShift` (`startMinutes` / `endMinutes`, `dayOfWeek`), `Commitment`, `Finance/FinanceEntryForm.tsx`. Verificado: não existe valor/hora no schema.
- Esforço: S/M. Migração: não (calculado). Escondido se não houver salário ou turnos, e respeita o modo privacidade.

## 22. Dias sem gastos
- Pitch: um contador opcional de dias seguidos sem despesas de lazer e um mini desafio do mês ("8 dias sem gastos em lazer"), ao lado do limite de lazer.
- Evidência: fraca. O desafio "no-spend" é popular nas comunidades de orçamento (subreddit nospend, comunidade YNAB), mas não foi confirmado numa app nesta pesquisa.
- Builds on: `FinanceEntry` (EXPENSE, categoria de lazer, `date`), `FinanceSettings.leisureBudgetCents`, `lib/badges.ts` (badge opcional).
- Esforço: S. Migração: não.

---

## Rejeitadas (e porquê)
- Captura por voz (tipo Todoist Ramble) com a Web Speech API: no Chrome o áudio é processado nos servidores da Google (dados a sair sem contrato) e o suporte é irregular (Firefox não tem). O Ramble usa IA paga.
- Co-planner com IA, divisão de tasks e estimador com IA (Tiimo AI, Goblin Tools): IA paga. A divisão a partir de tópicos e a previsão de duração já cobrem a parte barata.
- Dano partilhado tipo Habitica (o grupo perde vida se um falha): é punitivo, gera culpa e choca com o alerta de burnout. Os próprios reviewers apontam-no como desvantagem.
- Bichinho virtual tipo Finch ou Focus Friend: mascote já rejeitada (estilo puxa para emoji). O mecanismo útil (sessão que "falha") está na ideia 10.
- Bloqueio total do PC tipo Frozen Turkey (bloquear, terminar sessão, desligar): arrisca deixar alguém fora do PC no dia de um exame online, precisa de privilégios mais altos e é difícil de desfazer.
- Leaderboard de tempo de ecrã do agente (Opal): obriga a partilhar dados de uso do PC. O N73 cobre a parte social sem isso.
- Lista "Someday" tipo Things: `Task.date` é obrigatório (precisava de migração e mexia em todas as queries por data). O brain dump (N53) já serve de incubadora.
- Live Activity, widget de ecrã de bloqueio, notificação persistente no iOS: uma PWA não tem acesso. No Android já é o N34.
- "Safe to spend" automático com saldo do banco: integração bancária proibida. A ideia 2 usa só o limite e as entradas manuais.
- Contagens decrescentes genéricas (TickTick Countdown, maio de 2025): o `ExamCountdownCard` e o modo exame já cobrem o caso útil para estudantes. Pouco valor extra.
- Benchmark de minutos de foco contra a turma: turmas pequenas tornam a re-identificação fácil (mesma razão das rejeitadas v7).

## Fontes principais
- Tiimo: tiimoapp.com/features; App Store id1480220328 (App of the Year 2025)
- Structured: App Store id1499198946; habitbox.app/blog/structured-app-review
- Llama Life / Goblin Tools: g2.com/products/llama-life; adhd-audhd.vercel.app/en/tools/apps/goblin-tools
- one sec: one-sec.app/research (PNAS 2023, Grüning et al.)
- Opal: App Store id1497465230; makeheadway.com/blog/opal-app-review
- Cold Turkey: getcoldturkey.com/features; getcoldturkey.com/support/user-guide
- Forest: App Store id866450515
- Focus Friend: nbcnews.com/tech/tech-news/hank-green-focus-friend-app-rcna225967
- Duolingo: blog.duolingo.com/friend-streak; blog.duolingo.com/friends-quests; lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- Sunsama: roadmap.sunsama.com/changelog
- TickTick: alternativeto.net/software/ticktick/news; TickTick 6.4.10 release notes
- Akiflow: akiflow.com/features/command-bar; upbase.io/blog/akiflow-review
- Reclaim: help.reclaim.ai/en/articles/12304529-auto-schedule-breaks-travel-time-with-buffers
- Streaks: apps.apple.com/us/app/streaks/id963034692
- YNAB: thecollegeinvestor.com/20969/ynab-review; fincomparelab.com/guides/ynab-for-beginners
- Rocket Money / PocketGuard: rocketmoney.com/learn/personal-finance/rocket-money-vs-copilot; pocketguard.com/blog/pocketguard-vs-copilot-money
- Medisafe: help-center.medisafe.com/en/articles/8103161
- Fresh start effect: Dai, Milkman, Riis 2014 (Management Science 60(10)); psychologicalscience.org (Psych Science 2015)
- PWA: MDN "Display a badge on the app icon"; WebKit "Web Push for Web Apps on iOS and iPadOS"; WebKit bug 194593
- Dádiva de sangue: montepio.org; lisboa.ucp.pt; deco.proteste.pt/saude/doencas/dicas/dar-sangue-precisa-saber
