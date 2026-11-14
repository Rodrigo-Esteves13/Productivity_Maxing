# Pesquisa: features académicas, estudo e aprendizagem (14/11/2026)

Âmbito: notas, exames, cadeiras, métodos de estudo, flashcards, caderno, Turma, horário, tese/projetos e especificidades das universidades portuguesas.

Antes de propor, comparei com `pmaxing_ideias_atualizado(7).txt` (secções A-D, N1-N73 e a lista v6), `feature-research-2026-11.md`, `changelog.ts`, o trabalho por commitar (PracticeTest, ImportCardsModal, TaskMatrix, ReplanOverdue...) e `schema.prisma`. Também fiz grep no repo a cada conceito. Termos sem nenhum resultado: melhoria, calibration/predictedGrade, blurt, leech, cornell, wordGoal, erasmus, scholarship (fora de Finance), officeHours, prerequisite, studyMethod e épocas de exame no AcademicPeriod.

Ideias que já existem ou já estão no backlog, por isso ficaram de fora:
- MissingGradeCard (notas por lançar), CourseForecastCard, testGaps (folga entre avaliações), CreditSimulator e GradeNeededCalculator.
- PracticeTest (N57), exam scheduler (N58), cloze (N59), FSRS (N72), dúvidas por UC (N67), recursos por UC (N71) e conversão de notas (N51).
- Simulador de exame cronometrado, "explicar para aprender", mapa mental e flashcards a partir dos topics.

Legenda: esforço S/M/L. Mig indica se precisa de migração Prisma. A ordem é por valor a dividir por esforço.

---

## Ranking

### 1. Carga ECTS real vs esperada
- **Pitch:** Por cadeira, compara as horas de aula e de estudo registadas com as horas que os ECTS preveem (1 ECTS = 25-30 h). Avisa quando uma cadeira de 6 ECTS leva 40 h em vez de ~160.
- **Evidência:** ECTS Users' Guide 2015 (Comissão Europeia): 1 ECTS corresponde a 25-30 h e 60 ECTS a 1500-1800 h por ano. A Shovel (Purdue/Brightspace) vende exatamente esta ideia de "horas que precisas vs horas que tens".
- **Builds on:**
  - `Area.credits`
  - `StudySession.areaId`, `ClassOccurrence` (horas de aula) e `AcademicPeriod.startDate/endDate`
  - `backend/src/schedule/study-vs-class.util.ts` + `components/Schedule/StudyVsClassCard.tsx` (hoje compara estudo com aula, sem ECTS)
- **Esboço:** O valor esperado é `credits * horasPorEcts` (27 por defeito, ajustável 25-30 em localStorage). O esperado-até-hoje é o total vezes a fração do período já decorrida. Mostra uma barra por cadeira e o texto "abaixo do ritmo", sem cor verde. Só aparece quando há credits e datas do período.
- **Esforço:** S. **Mig:** não.

### 2. Blurting no fim da sessão de foco
- **Pitch:** Ao parar uma sessão ligada a uma cadeira ou task, há um passo opcional de 3 minutos: "escreve tudo o que te lembras". Depois mostra lado a lado os topics da task ou a última entrada do caderno dessa cadeira, para veres o que falhou.
- **Evidência:** Roediger & Karpicke 2006: um teste de recordação bate reler. O "blurting" é dos métodos mais recomendados em r/GetStudying e nos guias de revisão da Birmingham City University e da Save My Exams. Dunlosky 2013 classifica practice testing como "high utility".
- **Builds on:**
  - `components/Study/focus/StopSessionPanel.tsx`, `RateFocusPrompt.tsx` e `OpenNotesLink.tsx`
  - `StudySession.note` (o texto fica guardado aqui)
  - `Task.topics` e `NotebookEntry.areaId`
- **Esboço:** Um toggle "Blurt ao terminar" em localStorage. Os gaps assinalados pelo user ("não me lembrei disto") podem virar cartas através de `POST /flashcards/bulk`.
- **Esforço:** S. **Mig:** não.

### 3. Melhoria de nota: onde ganhas mais média
- **Pitch:** Lista as cadeiras aprovadas por quanto a média final do curso sobe se melhorares +1/+2 valores (ECTS x delta / ECTS totais). Assinala as que ainda podes melhorar: uma vez por UC, até ao recurso do ano seguinte, nunca em época especial.
- **Evidência:** Regulamentos de avaliação da FLUP (melhoria única, prevalece a nota mais alta), do IPS e do IST (época especial não serve para melhoria). Os alunos portugueses preocupam-se com a média de candidatura a mestrado.
- **Builds on:**
  - `backend/src/academic-programs/grade-average.util.ts` (computeCreditWeightedAverage)
  - `components/Dashboard/CreditSimulator.tsx` e `GpaSummary.tsx`
  - `pages/ReportCard.tsx` e `Area.credits`
- **Esboço:** Uma função pura `lib/gradeImprovement.ts` com testes. Um cartão no Report card e no Dashboard. O prazo de elegibilidade é aproximado e tem aviso "confirma no regulamento da tua escola".
- **Esforço:** S. **Mig:** não.

### 4. Previsão vs nota real (calibração)
- **Pitch:** Logo depois de completares um teste ou exame, a app pergunta com um toque "que nota achas que tiveste?". Quando a nota real sai, mostra a diferença. Um cartão acompanha se és sobre- ou sub-confiante, por cadeira e ao longo do semestre.
- **Evidência:**
  - Hacker, Bol et al. 2000 (J. Educ. Psych.).
  - "Low-Performing Students Confidently Overpredict Their Grade Performance throughout the Semester" (PMC10607382): os alunos fracos sobrestimam várias letras de nota, e a sobreconfiança faz parar de estudar cedo demais.
  - O feedback sobre a calibração melhora-a.
- **Builds on:**
  - O padrão de pergunta após completar em `frontend/src/lib/onTimeQuestion.ts`
  - `Task.targetGrade` e `Task.realGrade`
  - `components/Dashboard/MissingGradeCard.tsx` (já pede a nota real)
  - `lib/examMode.ts` isExamTask
- **Esboço:** O cartão mostra o erro médio com sinal e a contagem (mínimo 3). O aviso "costumas sobrestimar 2 valores" aparece no ExamModePanel antes do próximo exame.
- **Esforço:** S/M. **Mig:** sim, `Task.predictedGrade Float?`.

### 5. Revisão no próprio dia da aula
- **Pitch:** Ao fim do dia, a app mostra "Rever apontamentos de hoje: X, Y (10 min cada)" para as aulas a que foste, com link para a entrada do caderno ligada à aula. Há push opcional, desligado por defeito.
- **Evidência:** O método Cornell (Pauk, Cornell Learning Strategies Center) e os learning centers (Utah State, Villanova) recomendam rever e resumir pouco depois da aula. O espaçamento ("distributed practice", Dunlosky 2013) é "high utility". Hoje as revisões espaçadas (N10) só nascem quando completas uma task, nunca de uma aula.
- **Builds on:**
  - `ClassOccurrence.attended`
  - A ligação entrada-aula (`components/Notebook/NotebookScheduleLink.tsx`)
  - `hooks/useTodayOverview.ts` e `TodayCard.tsx`
  - O cron `backend/src/reminders/*` + `SentNotification` dedupe e `lib/pushKinds.ts`
- **Esboço:** Lista calculada sem tabela nova. Marcar como revisto guarda a chave do dia em localStorage, ou cria uma StudySession manual de 10 min se o user quiser contar o tempo.
- **Esforço:** S. **Mig:** não.

### 6. Cartas "sanguessuga" (leeches)
- **Pitch:** As cartas que falhaste 8 ou mais vezes ficam marcadas, com o conselho "reescreve, divide em duas ou transforma em cloze". Há um filtro "Difíceis" no DeckList.
- **Evidência:** Anki manual, secção Leeches: o limiar por defeito é 8 lapses, com aviso repetido a cada metade do limiar. Uma carta mal formulada gasta tempo desproporcionado.
- **Builds on:**
  - `Flashcard.lapses` (já existe)
  - `components/Flashcards/DeckList.tsx`, `decks.ts` e `CardEditor.tsx`
  - `backend/src/flashcards/flashcards.service.ts`
- **Esboço:** Limiar numa constante em `flashcards.constants.ts`. Um aviso aparece no ReviewSession quando uma carta atinge o limiar. Suspender fica para uma v2 (precisaria de `Flashcard.suspendedAt`).
- **Esforço:** S. **Mig:** não (v1).

### 7. Previsão de revisões de flashcards (30 dias)
- **Pitch:** Um gráfico de quantas cartas vencem em cada um dos próximos 30 dias, por cadeira, com aviso "semana de 3-7 Dez: 240 revisões, coincide com 2 exames".
- **Evidência:** Anki Statistics, gráfico "Future Due". O RemNote também mostra a carga futura no exam scheduler.
- **Builds on:**
  - `GET /flashcards/stats` (hoje só devolve total e due)
  - O índice `@@index([userId, dueAt])`
  - `ExamCountdownCard.tsx` e `lib/examMode.ts` para cruzar com os exames
  - `chartExport` para exportar PNG
- **Esboço:** Novo `GET /flashcards/forecast?days=30` que agrupa `dueAt` por dia e por área, em fuso Lisboa.
- **Esforço:** S. **Mig:** não.

### 8. Cartas nos dois sentidos
- **Pitch:** Ao criar ou importar uma carta, a opção "criar também a inversa" gera a carta verso-frente. Serve para vocabulário, definições e fórmulas.
- **Evidência:** Nota "Basic (and reversed card)" do Anki. Quizlet "Answer with: term/definition".
- **Builds on:** `components/Flashcards/CardEditor.tsx`, `ImportCardsModal.tsx` e `POST /flashcards/bulk` (por commitar), com o limite `MAX_FLASHCARDS_PER_USER`.
- **Esboço:** Cria duas cartas independentes, cada uma com o seu SM-2. Em vez de dar erro, avisa se a inversa passa o limite de cartas.
- **Esforço:** S. **Mig:** não.

### 9. Alerta de aproveitamento para a bolsa (DGES)
- **Pitch:** Para quem tem bolsa: "Para renovar precisas de aprovação a 36 ECTS. Já tens 18, faltam 18 em 4 UCs abertas, e a chance de passar a pelo menos 3 delas é baixa." O limiar é configurável.
- **Evidência:**
  - Regulamento de Atribuição de Bolsas DGES. O Despacho 12780-B/2011 tinha a regra dos 60% dos ECTS, alterada em 2017 (Despacho 5404/2017).
  - O guia SAS ISCTE 2023 diz: com inscrição a 36 ou mais ECTS, é preciso aproveitamento a 36. Com menos, é preciso aprovação a todas as UCs.
  - A regra muda entre anos, por isso tem de ser editável.
- **Builds on:**
  - `Area.credits` e `CreditsAccumulatedCard.tsx`
  - `backend/src/course-risk/course-risk-pass-chance.util.ts` (chance por UC)
  - As regras de aprovação
  - O padrão de preferência no cliente de `hooks/useAbsenceLimitPref.ts`
- **Esboço:** A v1 guarda em localStorage (tem bolsa, limiar, ECTS inscritos), sem migração. Cartão no Dashboard. O texto nunca diz "vais perder a bolsa", só mostra os números.
- **Esforço:** S/M. **Mig:** não (v1). Sim para cross-device (`User.scholarshipMinEcts Int?`).

### 10. Épocas do período (Normal, Recurso, Especial)
- **Pitch:** Cada período passa a ter as datas de fim das aulas, época normal e época de recurso. O exam mode liga-se sozinho na época, o countdown conta até à época e o plano de estudo sabe que o recurso existe.
- **Evidência:** Regulamentos da U. Évora, ESE-IPP e IPS: três épocas, com o recurso nas últimas 2 semanas do semestre ou depois da normal. Sigarra/UP publica "épocas de exame" por faculdade. Hoje `AcademicPeriod` só tem startDate/endDate.
- **Builds on:**
  - `AcademicPeriod`, `backend/src/academic-programs/periods.service.ts` e o form de período
  - `hooks/useExamMode.ts` / `lib/examMode.ts` e `ExamCountdownCard.tsx`
  - `lib/ptHolidays.ts`
- **Esboço:** Todos os campos são opcionais. O exam mode só faz sugestão automática ("Estás em época normal, ativar exam mode?"), nunca se força.
- **Esforço:** M. **Mig:** sim, `AcademicPeriod.classesEndOn`, `normalSeasonStart`, `normalSeasonEnd`, `resitSeasonStart`, `resitSeasonEnd` (DateTime?).

### 11. Plano de recurso num clique
- **Pitch:** Quando uma cadeira fica reprovada na avaliação contínua ou na época normal, aparece um cartão "Vais a recurso em X?". Um clique cria a task de exame de recurso com peso 100% e data "por marcar" (ou dentro da época de recurso, se existir a ideia 10), mostra a nota necessária segundo as regras e reabre as flashcards dessa cadeira.
- **Evidência:** A pista de recurso das regras de aprovação (exame a 100%, uma tentativa) já está modelada, mas o aluno ainda tem de criar a task à mão. A FLUP admite em recurso os reprovados, desistentes e faltosos.
- **Builds on:**
  - `backend/src/approval-rules/pass-probability.ts` (hasResitTrack) e `course-risk/`
  - `DateCertainty` (data por marcar nunca fica em atraso)
  - `GradeNeededCalculator.tsx` e `TaskForm` prefill (`/tasks?new=1`)
- **Esforço:** S/M. **Mig:** não.

### 12. Reflexão pós-exame (exam wrapper)
- **Pitch:** Quando lanças a nota de um teste, aparecem 3 perguntas de 1 minuto:
  - Como te preparaste? Horas e métodos já vêm preenchidos das sessões.
  - Onde perdeste pontos? Opções: conceito, distração/contas, tempo, matéria não estudada.
  - O que mudas no próximo?

  A resposta da terceira vira um passo da checklist da próxima avaliação da mesma cadeira.
- **Evidência:** Exam wrappers de Marsha Lovett (Carnegie Mellon, Eberly Center), com materiais da U. Waterloo CTE e do NYIT CTL. Alunos com mais exposição adotam estratégias de estudo mais eficazes.
- **Builds on:**
  - O momento em que se lança a `realGrade` (`MissingGradeCard.tsx`, TaskEditForm)
  - Os minutos por task de `StudySession` / `session-attribution.util.ts`
  - `Subtask` + `SubtaskChecklist.tsx` e `Task.notes`
- **Esboço:** A v1 guarda a reflexão como bloco em `Task.notes` e o passo como Subtask da próxima task de exame, sem migração. A agregação "erros mais comuns" precisaria de campo próprio.
- **Esforço:** M. **Mig:** não (v1). Opcional `Task.examReflection Json?`.

### 13. Método de estudo por sessão: o que funciona para ti
- **Pitch:** Ao iniciar ou parar uma sessão, escolhes o método (exercícios, exames antigos, flashcards, resumo, reler, explicar em voz alta). O cartão mostra a tua nota por cadeira contra o mix de métodos. Antes de um exame, avisa "70% do teu tempo em X foi a reler".
- **Evidência:** Dunlosky et al. 2013 (Psychological Science in the Public Interest): practice testing e distributed practice são "high utility", reler, sublinhar e resumir são "low". A rubrica "Study methods that actually work" de r/GetStudying diz o mesmo.
- **Builds on:**
  - `components/Study/focus/SessionForm.tsx` e `StopSessionPanel.tsx`
  - `backend/src/study-plan/focus-effect.util.ts` (correlações com amostra mínima)
  - O padrão de `DifficultyVsGradeCard.tsx`
- **Esforço:** M. **Mig:** sim, `StudySession.method` (enum `StudyMethod`, nullable).

### 14. Prontidão para o exame
- **Pitch:** Para cada exame dos próximos 14 dias há um indicador com as razões visíveis:
  - minutos estudados contra o estimado
  - % da checklist de tópicos feita
  - cartas da cadeira em atraso e leeches
  - dias de folga até ao exame

  É um sinal objetivo para contrabalançar a sensação de "já sei".
- **Evidência:** RemNote Exam Scheduler, Shovel ("tens tempo suficiente?") e a literatura de calibração da ideia 4.
- **Builds on:**
  - `components/Dashboard/ExamModePanel.tsx`
  - `backend/src/study-plan/study-plan.estimates.ts` e CourseForecastCard
  - `Flashcard.areaId`, `Subtask` e `lib/testGaps.ts`
- **Esboço:** Uma função pura com pesos numa constante. Sem dados suficientes, não mostra nada. Não é nota prevista, é só preparação.
- **Esforço:** M. **Mig:** não.

### 15. Apontamentos Cornell no caderno
- **Pitch:** Um modelo de entrada com coluna de pistas, notas e resumo. Cada pista vira uma carta (pista na frente, parágrafo no verso) com um clique. O resumo aparece como pedido na revisão do próprio dia (ideia 5).
- **Evidência:** Walter Pauk / Cornell Learning Strategies Center. Guias da Bryn Mawr, Utah State e U. Cincinnati: a coluna de pistas serve de auto-teste.
- **Builds on:**
  - `components/Notebook/NotebookEntryEditor.tsx` e `NotebookTableEditor.tsx` (tabela de 2 colunas)
  - `POST /flashcards/bulk`
  - O fluxo "Make card" da N59 (partilham o parser de seleção)
- **Esforço:** S/M. **Mig:** não.

### 16. Logística do exame
- **Pitch:** Campos de sala, lugar/turma, material permitido (calculadora, formulário, consulta) e "inscrição no exame até" (há escolas que exigem inscrição 48 h antes). Aparecem no exam mode, no TodayCard do dia e na push de véspera.
- **Evidência:**
  - O IPS exige inscrição em exames de época normal e recurso no Infoestudante até 48 h antes.
  - Os horários de exame (Essex) mostram data, hora, sala e lugar.
  - O MyStudyLife tem sala e lugar no formulário de exame.
- **Builds on:**
  - `Task` com tipo exame (`lib/examMode.ts`)
  - `ExamModePanel.tsx` e `TodayCard.tsx`
  - O cron `due-today-reminders.service.ts`
- **Esboço:** O "inscrição até" cria um lembrete datado. Em alternativa, a v1 sem migração é um template de checklist "Exame" em `lib/taskTemplates.ts`.
- **Esforço:** S. **Mig:** sim, `Task.examRoom String?`, `examSeat String?`, `examMaterials String?`, `examSignupBy DateTime?`.

### 17. Confiança por tópico
- **Pitch:** Na checklist de tópicos de um exame, dás nota de 1 a 3 a cada tópico ("não sei", "mais ou menos", "sei"). O plano de estudo e a prontidão dão prioridade aos mais fracos, e depois de estudar voltas a avaliar.
- **Evidência:** As "Personal Learning Checklists" e o RAG rating de revisão são práticas comuns no secundário do Reino Unido. A literatura de calibração (Hacker/Bol) diz que juízos repetidos com feedback melhoram a monitorização.
- **Builds on:**
  - `Subtask` e `components/Tasks/SubtaskChecklist.tsx`
  - `lib/checklistFromTopics.ts` (por commitar)
  - `study-plan.scheduler.ts`
- **Esboço:** UI com intensidade do accent, sem verde nem semáforo.
- **Esforço:** M. **Mig:** sim, `Subtask.confidence Int?`.

### 18. Baralhos partilhados na turma
- **Pitch:** Um membro publica o baralho de uma cadeira na Turma e cada colega importa uma cópia com o seu próprio agendamento. Atualizações seguem o padrão de aprovação dos packs.
- **Evidência:** Quizlet Classes (os membros têm Learn/Test grátis nos sets da turma), Anki Shared Decks e StudySmarter (partilha de sets). Hoje as Turmas partilham packs, notas e ficheiros, mas não cartas (grep de flashcard em `backend/src/turmas` dá zero).
- **Builds on:**
  - `TurmaPack` + `components/Turma/TurmaPacksTab.tsx` (mesmo fluxo de publicar e importar)
  - `TurmaLinkedArea` e `POST /flashcards/bulk`
- **Esboço:** A cópia guarda só frente e verso, nunca o progresso de quem publicou.
- **Esforço:** M. **Mig:** sim, `TurmaDeck { id, turmaId, authorId, areaName, cards Json, version, createdAt }`.

### 19. Meta de escrita para tese ou relatório
- **Pitch:** Numa task de projeto (dissertação, relatório de estágio, trabalho final), defines palavras-alvo e prazo. A app calcula as palavras por dia que faltam, só em dias de escrita, e recalcula quando falhas um dia. Mostra também gráfico e streak de escrita.
- **Evidência:** Scrivener Project Targets (meta diária a partir do prazo, recalcula sozinha, escolhe dias de escrita). Nos fóruns da Literature & Latte pedem metas semanais e mensais. É o padrão do #AcWriMo.
- **Builds on:**
  - `frontend/src/lib/wordCount.ts` (conta entradas do caderno ligadas à task)
  - `Task.estimatedMinutes` e `lib/lighterDay.ts`
  - `StudyActivityCard.tsx` (grelha)
- **Esboço:** O registo diário pode ser manual ou automático a partir do caderno.
- **Esforço:** M. **Mig:** sim, `Task.wordTarget Int?` e `TaskWordLog { taskId, date, words @@unique([taskId,date]) }`.

### 20. Dúvidas da turma com "também tenho esta dúvida"
- **Pitch:** Q&A dentro da Turma. Qualquer membro pergunta (pode ser anónimo para os colegas). Os outros carregam em "também tenho" em vez de repetir, e o delegado leva as mais votadas ao docente e marca a resposta.
- **Evidência:** Piazza (anónimo para colegas, Live Q&A com upvotes) e Ed Discussion (Heart para "também me interessa", marcar duplicados). Complementa a N67, que é privada e por UC.
- **Builds on:**
  - Os papéis da Turma (`TurmaRole`, delegado) e `components/Turma/TurmaAnnouncementsTab.tsx`
  - `turmaConfig.ts` (novo tab `questions`)
  - Push de turma
- **Esboço:** O anonimato é só perante colegas. O dono e o delegado veem o autor, para moderação. Tem rate limit e limites de tamanho.
- **Esforço:** M. **Mig:** sim, `TurmaQuestion { turmaId, authorId, areaName?, text, isAnonymous, answer?, answeredAt }` e `TurmaQuestionVote @@unique([questionId,userId])`.

### 21. Horário de atendimento dos docentes
- **Pitch:** Guardas o horário de atendimento de cada cadeira (dia, hora, sala). Aparece como faixa leve na vista semanal e, havendo dúvidas abertas (N67), mostra "atendimento de X amanhã às 14:00, tens 3 dúvidas".
- **Evidência:** Os learning centers (Cornell LSC, Bryn Mawr academic support) recomendam ir ao atendimento. O docente já existe por cadeira (N45), mas o horário de atendimento não (grep officeHours/atendimento dá zero).
- **Builds on:** `AreaTeacherNote`, `components/Schedule/WeekGrid.tsx` / `WeekDayCell.tsx` e `components/Areas/AreaDetailView.tsx`.
- **Esforço:** S/M. **Mig:** sim, `AreaOfficeHour { userId, areaId, weekday, startMinutes, endMinutes, place? }`.

### 22. Learning Agreement Erasmus
- **Pitch:** Para quem vai em mobilidade, regista as cadeiras de destino (Tabela A) ligadas às cadeiras de origem que reconhecem (Tabela B), com ECTS e estado (proposto, aprovado, alterado). Avisa quando a soma de ECTS não bate. No regresso, a nota convertida (N51) entra na cadeira de origem.
- **Evidência:** O Online Learning Agreement Erasmus+ tem Tabelas A/B e alterações A2/B2 durante a mobilidade, e os ECTS da cadeira trocada têm de bater (guias da TU Wien, VSE e CZU).
- **Builds on:** `AcademicProgram` / `AcademicPeriod` (período "Erasmus"), `Area.credits`, `lib/gradeScale.ts` e a conversão N51.
- **Esforço:** M. **Mig:** sim, `MobilityCourse { userId, periodId, hostName, hostEcts, homeAreaId?, status, hostGrade? }`.

### 23. Planeador de inscrições do próximo semestre
- **Pitch:** Antes das inscrições, escolhes as cadeiras do próximo período, incluindo as em atraso. Vês a soma de ECTS contra o limite anual, o impacto na carga semanal (com as horas por ECTS da ideia 1) e que cadeiras reprovadas convém repetir primeiro.
- **Evidência:** As inscrições no Sigarra/Fénix têm limites de ECTS por ano. Inscrever-se em demasiadas cadeiras está ligado ao risco de perder a bolsa (ideia 9).
- **Builds on:** `AcademicPeriod`, `Area.credits`, as cadeiras reprovadas via course-risk e approval rules, e `CreditSimulator.tsx`.
- **Esforço:** M/L. **Mig:** sim, mínimo `AcademicPeriod.isPlanned Boolean` (período rascunho).

---

## Rejeitadas

- **Intercalar (interleaving) as flashcards:** A evidência é forte (Rohrer & Taylor 2007: problemas misturados batem blocos uma semana depois). Mas a revisão "todas as cadeiras" já mistura cartas por dueAt, por isso o ganho seria pequeno. Antes de propor interleaving no plano de estudo era preciso ler `study-plan.scheduler.ts` com mais calma.
- **Rota de apontamentos na turma** (quem tira apontamentos em cada aula): nicho, pouca evidência, e precisa de modelo novo e de coordenação social.
- **Registo de exames antigos resolvidos:** fica demasiado perto do "simulador de exame cronometrado" e do "banco de exames" que já estão na lista. As notas de prática podem entrar como GradeEntry num componente "Prática".
- **Gerador de citações (APA/NP 405) e import de DOI:** buscar metadados de DOI no servidor é um pedido externo, e o import manual de BibTeX vale pouco para a licenciatura.
- **Média de candidatura ao mestrado com fórmulas oficiais:** as fórmulas variam por instituição e curso. O Report card e a ideia 3 já cobrem o essencial.
- **Ligação ao Sigarra, Fénix ou Moodle para notas e horários:** credenciais da universidade, scraping e SSRF, já rejeitado antes.
- **Resumo de aula ou explicação por IA (Feynman com LLM):** API paga, já rejeitado. O "explicar para aprender" sem IA já está na lista v6.
- **Estatuto trabalhador-estudante** (direitos a época especial e faltas): as regras variam por escola. Fica coberto pelas épocas (ideia 10) com uma nota livre.
- **Retenção real das flashcards** (true retention à Anki): precisa de um log de revisões (`FlashcardReview`) com muitas linhas. Fica para quando se fizer o FSRS (N72), que também precisa do log.

## Fontes principais

- ECTS Users' Guide 2015: education.ec.europa.eu/sites/default/files/document-library-docs/ects-users-guide_en.pdf
- Dunlosky et al. 2013, PSPI 14(1): psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html
- Calibração: pmc.ncbi.nlm.nih.gov/articles/PMC10607382
- Exam wrappers: uwaterloo.ca/centre-for-teaching-excellence/node/4521 ; nyit.edu/ctl/blog/exam_reflections_promoting_metacognition_and_self_regulated_learning
- Anki leeches e stats: docs.ankiweb.net/manual/leeches ; docs.ankiweb.net/stats.html
- Blurting e active recall: bcu.ac.uk/exams-and-revision/best-ways-to-revise/the-blurting-method ; savemyexams.com/learning-hub/revision-tips/blurting-method-revision/
- Interleaving: digitalcommons.usf.edu/psy_facpub/1767/
- Bolsas DGES: diariodarepublica.pt/dr/detalhe/despacho/5404-2017-107524771 ; iscte-iul.pt (cartaz SAS bolsas DGES 2023)
- Épocas e melhoria: sigarra.up.pt/flup/pt/p/epocas_exame ; ips.pt/estudar/atividades-academicas-estudantes/exames/ ; conselhopedagogico.tecnico.ulisboa.pt (regulamento de avaliações)
- Erasmus OLA: czu.cz (online learning agreement changes) ; ozs.vse.cz OLA-During_EN.pdf
- Cornell: alumni.cornell.edu ; usu.edu/academic-support/note_taking/cornell_note_taking
- Scrivener targets: literatureandlatte.com blog ; well-storied.com
- Piazza e Ed: academictech.uchicago.edu (Ed Discussion) ; campustechnology.com (Piazza Live Q&A)
- Quizlet classes: help.quizlet.com/hc/articles/360030513392
- Shovel: purdue.edu/teaching-learning/programs/sst (Shovel overview) ; App Store id1467742357
