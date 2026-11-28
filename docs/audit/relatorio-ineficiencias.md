# Relatório de ineficiências da arquitetura e fricções de UX

Data: 2026-11-22. Branch `feat/fase-7-extra-features`. Auditoria só de pesquisa: não foi alterado código, não houve commits nem migrações. Repo `D:\Productivity_Maxing` (frontend `frontend/src`, backend `backend/src`, agente Go `agent`, que não foi auditado a fundo, ver secção 10).

Este relatório complementa `docs/audit/silent-bugs-report.md` (bugs silenciosos). Aqui o foco são ineficiências, dívida técnica e pequenas fricções. Os bugs já listados lá não são repetidos, só referidos quando tocam o mesmo tema.

## 1. Resumo

Seis agentes de leitura de código correram em paralelo (Prisma e queries, qualidade do backend, arquitetura do frontend, fricções UX grupo A, fricções UX grupo B, verificações transversais). Cada achado traz ficheiro:linha. Eu voltei a confirmar no código, em primeira mão, os achados mais importantes (ver secção 9); os restantes assentam na leitura do agente da área, marcados como "traço do agente" quando não os reli.

Gravidade usada: **Alta** = perda ou corrupção silenciosa de dados, dado errado visível ao utilizador, ou endpoint caro sem limite chamável por qualquer utilizador. **Média** = abuso possível, incoerência com impacto real, ou atrito frequente. **Baixa** = higiene, manutenção, atrito pontual. **Info** = observação sem ação.

### Totais por gravidade (brutos, antes de retirar duplicados)

| Área | Alta | Média | Baixa | Info | Total |
|---|---|---|---|---|---|
| Backend: dados e Prisma (B-20 a B-47) | 1 | 9 | 18 | 0 | 28 |
| Backend: qualidade, DTO, throttle, testes (S-01 a S-37) | 4 | 14 | 19 | 0 | 37 |
| Frontend: arquitetura e estado (F-01 a F-61) | 2 | 18 | 37 | 4 | 61 |
| Fricções UX A (U-A01 a U-A36) | 2 | 15 | 19 | 0 | 36 |
| Fricções UX B (U-B01 a U-B46) | 4 | 17 | 25 | 0 | 46 |
| Transversal (T-01 a T-05) | 0 | 0 | 5 | 0 | 5 |
| **Total bruto** | **13** | **73** | **123** | **4** | **213** |

Duplicados entre agentes (contados nos dois lados da tabela acima): B-20 = S-03 (export RGPD sem throttle), B-29 e S-01 (bulk de tarefas sem efeitos), B-24 = S-08 (pesquisa do caderno), B-33 e S-17 (agregações sem cache), B-32 = S-33 (lista de utilizadores sem paginação), B-43 = S-37 (escritas sem `userId`), U-A01 = U-B01 = T-01 (modais fecham ao clicar fora), U-A09 e U-B26 (títulos de página em inglês), U-A10 e U-B46 (datas e números sem a língua da app), U-A20 e T-05 (placeholders em inglês). Depois de retirar duplicados ficam cerca de **200 achados únicos**, dos quais **cerca de 11 Alta**.

Os níveis Alta/Média/Baixa dos agentes de frontend e UX foram atribuídos por mim com base na descrição do impacto; os do backend vêm dos agentes.

### O que sai mais caro hoje, em poucas linhas

1. **Estado desatualizado entre cartões (o padrão do bug do Wellbeing).** O frontend não tem camada de dados partilhada: cada cartão faz o seu `useLoadOnce` e só se atualiza por `refreshKey`, `version` ou 4 mini barramentos de eventos. O Focus (F-04) e o Dashboard (F-06, cerca de 12 cartões) têm o mesmo bug: apagar uma sessão ou concluir uma tarefa deixa anel de progresso, streak, previsão de nota e risco de chumbar errados até F5.
2. **Modal que fecha ao clicar fora, sem aviso (U-A01, 33 consumidores).** Um clique no fundo ou Escape perde o texto de todos os formulários. Correção única em `components/UI/Modal.tsx:101-104` (prop `isDirty`).
3. **Apagar sem desfazer, em quase tudo** (tarefas, finanças, cartões, notas, turnos). Concluir tem desfazer, apagar não (U-A05, U-B06).
4. **Export RGPD sem throttle (B-20/S-03).** 16 + 26 queries em paralelo, pool Prisma fixo em 10 ligações (`prisma.service.ts:32`): um utilizador autenticado pode degradar a app para todos.
5. **Ações em massa saltam regras de negócio (S-01, B-29, S-02).** "Marcar feitas" em massa não gera recorrências, revisões espaçadas nem desbloqueia dependentes; editar prazo de turma altera tarefas de outros utilizadores sem validar pesos nem gravar histórico.
6. **Coisas que se criam mas não se editam**, com endpoint já existente sem UI: renomear quiz (U-A02), título de subtarefa (U-A03), rótulo e data de nota de componente (U-A24), `isActive` de programa (U-A36), apagar humor (U-B12), `status=all` de appeals (U-B36), apagar aulas por intervalo (U-B21), `removeGrant` do leitor (U-B41). São os quick wins mais baratos: o backend já está pronto.
7. **Auth sem testes (S-04):** 2FA, TOTP, fusão OAuth e API keys sem nenhum spec.

## 2. Ordem de correção sugerida

### 2.1 Quick wins (esforço S, risco baixo, fazer primeiro)

Cada linha é um ou poucos achados com a mesma correção.

1. `@Throttle` no export RGPD (B-20/S-03), no avatar (S-06), no sync do Google Calendar (S-07), em `decideAccessRequest` (S-12).
2. Ligar os botões que já têm endpoint: U-A02 (renomear quiz), U-A03 (título de subtarefa), U-A24 (rótulo e data da nota), U-B12 (limpar humor), U-B36 (separador "Resolvidos" em appeals), U-B41 ("Cancelar pedido" e "Deixar de ver"), U-A36 (arquivar programa).
3. Toasts de sucesso uniformes ao gravar (U-A06, U-A19, U-B05, U-B24, U-A13, U-A16, U-A27, U-A35) e verificar o booleano devolvido antes de fechar diálogos (U-A14, U-B07).
4. Chaves de i18n em vez de texto inglês: `useDocumentTitle('...')` em 7 páginas (U-A09, U-B26), placeholders (U-A20, T-05), datas e números com a língua da app (U-A10, U-B46, U-B18, U-B31, U-B35, U-B37).
5. Confirmar ou dar desfazer onde falta e é perigoso: descartar tentativa de quiz (U-A34), desativar tipo de tarefa (U-A17), banir IP (U-B33), revogar acesso a notas (U-B42), apagar turno e exceção (U-B22, U-B23).
6. Escape fecha também o modal por baixo do `ConfirmDialog` (U-B02): pilha de modais.
7. Chaves de refetch: `useMedicationReminderStatus` com `meds.version` (F-01), refetch silencioso no Focus (F-05), refetch de dívidas só quando mudam (F-17), debounce de pesquisa nos security logs (U-B34).
8. Índices: `@@index([submissionDate])` (B-21), uniques parciais (B-23, B-31). Migrações na secção 8.
9. `manualChunks` no `vite.config.ts` (F-44) e `lazyWithPreload` para modais pontuais e Register/ForgotPassword (F-45).
10. Constantes: `isUniqueViolation` único (S-27), `safeEqual` (S-26), `MS_PER_DAY` e `APP_TIME_ZONE` (S-30), chaves do `localStorage` e intervalos de polling (F-52, F-53).
11. Logs e erros: tirar email e query string do log por pedido (S-13), email do conflito OAuth no fragmento `#` (S-35), `PrismaExceptionFilter` global (S-14, M).

### 2.2 Depois, por impacto

1. **Camada de estado partilhada no frontend** (F-04, F-06, F-07, F-08, F-10, F-11, F-12, F-14, F-16, F-47, F-48). Decisão de arquitetura: ou o padrão atual (versão/evento por domínio) aplicado a Focus, Dashboard, Áreas e Social, ou adotar TanStack Query, que resolve o estado desatualizado, o refetch inútil e a falta de cache de catálogo de uma vez. Recomendação: começar pelo padrão atual no Focus e no Dashboard (M, risco baixo) e avaliar TanStack Query para o resto.
2. **Guarda de alterações no Modal** (U-A01/U-B01) e **desfazer ao apagar** (U-A05, U-B06): toast com Desfazer que recria o registo, ou apagar diferido.
3. **Efeitos laterais dos caminhos em massa e dos prazos de turma** (S-01, B-29, S-02, B-27): extrair `applyCompletionSideEffects` e `TasksService.applyLinkedDeadlineChange`.
4. **Pesquisa e agregações no servidor** (B-24/S-08, B-33/S-17, B-34, F-51), reordenar em SQL (B-25), import em lote (B-26, B-27).
5. **Testes dos serviços de risco**: auth (S-04), depois S-18 e S-36.
6. **Páginas sem pesquisa/filtro**: `/tasks` (U-A08), movimentos de finanças (U-B08), quizzes (U-A33), flashcards (U-A31), notas pessoais (U-A26), notas de amigos (U-B44), feedback admin (U-B37).
7. **Mobile**: alvos de toque abaixo de 44px (U-B03, U-B25, U-B16, U-A04, U-A21, U-A24), tabelas só com scroll horizontal (U-B31, U-B34, U-B35), `vh` em vez de `dvh` no Pad (U-A28).
8. **Refatoração gradual**: duplicação de hooks (F-26 a F-30), ficheiros grandes (F-34, F-36, F-37, F-39), `auth.controller.ts` (S-16, L), dicionário i18n em chunks por rota (F-43, L).

## 3. Como ler as tabelas

Colunas: ID, gravidade (quando existe), área, ficheiro:linha, o que está mal, impacto, correção proposta, esforço (S pequeno, M médio, L grande), risco da correção, precisa de migração. Os caminhos de frontend nas secções 5 a 7 são relativos a `frontend/src`; os de backend, a `backend/src`. Onde as tabelas dos agentes não trazem coluna de gravidade (frontend e UX), vale a classificação da secção 1 (Alta: F-04, F-06, U-A01, U-B01, U-B02, U-B04, U-B06 e U-A05; Média: ver secção 2.2; Baixa: o resto).

IDs: B-xx (dados e Prisma, começam em B-20 para não colidir com os B-01 a B-13 do relatório de silent bugs), S-xx (qualidade do backend), F-xx (arquitetura do frontend), U-Axx e U-Bxx (fricções), T-xx (transversal).

Os 5 itens "T" correspondem às linhas da tabela transversal do secção 5.2, por ordem: T-01 Modal fecha no fundo, T-02 hex cruas fora dos temas, T-03 `truncate` sem `title`, T-04 `setInterval` fora de `useVisibleInterval`, T-05 placeholders em inglês.

## 4. Achados de arquitetura: backend

### 4.1 Dados, Prisma e queries (B-20 a B-47)

| ID | Gravidade | Área | Ficheiro:linha | O que está mal | Impacto | Correção proposta | Esforço | Risco | Migração |
|---|---|---|---|---|---|---|---|---|---|
| B-20 | High | users (export RGPD) | `users/users.service.ts:256`, `:332`, `:466`; `users/users.controller.ts:46` | `exportUserData` dispara um `Promise.all` de 16 queries, depois outro de 26, depois 3, depois mais 1. Carrega todo o histórico (tasks com subtasks, entradas do caderno com JSON de desenho, pads com conteúdo, sessões, finanças). O endpoint `GET /users/me/export` não tem `@Throttle` próprio, só o global de 100/min. | Um único utilizador autenticado ocupa as 10 ligações do pool em cada pedido. Repetido algumas vezes por segundo, a app fica lenta para toda a gente (negação de serviço sem privilégios). Memória: o JSON inteiro fica em RAM. | `@Throttle` dedicado (ex.: 2 por minuto, como o export de finanças em `finance.constants.ts:17`). Correr as queries em lotes de 3 ou 4 em vez de 26 de uma vez. A prazo, gerar o ficheiro em background e enviar link. | S (throttle), M (lotes) | Baixo | não |
| B-21 | Medium | schema / reminders | `schema.prisma:912` (`submissionDate` sem índice); `reminders/reminders.service.ts:120-161` | O cron de lembretes procura em TODOS os users `OR: [{ date: window }, { submissionDate: window }]`. Há `@@index([date])` (`schema.prisma:998`) mas não há índice em `submissionDate`, por isso o Postgres não consegue um BitmapOr e lê a tabela Task inteira. | Seq scan à tabela maior da app a cada execução do cron. Cresce linearmente com o número de tasks de todos os users. | `@@index([submissionDate])` em Task (idealmente parcial `WHERE "submissionDate" IS NOT NULL` via SQL na migração). | S | Baixo | sim, `--name task_submission_date_index` |
| B-22 | Medium | schema (FK sem índice) | Ver lista na nota B-22 | Várias colunas FK não têm índice que comece por elas. São usadas em `ON DELETE CASCADE/SET NULL` (apagar conta, Área, período, programa, pacote) e em `where` do export RGPD. | Apagar uma conta ou uma Área faz um seq scan por cada FK sem índice (Postgres tem de procurar as linhas filhas). O export faz seq scans em `Feedback`, `Pad`, `TurmaNote`, `TurmaFile`, `TurmaAnnouncement`, `TurmaPack`. Lento e com locks mais longos à medida que as tabelas crescem. | Acrescentar `@@index` às colunas da nota B-22. | S | Baixo (só escrita ligeiramente mais cara) | sim, `--name fk_indexes` |
| B-23 | Medium | schema / study-sessions | `study-sessions/study-sessions.service.ts:175-205`; `schema.prisma:1162-1215` | "Só uma sessão ativa por user" é verificado com `findFirst` e depois `create`, sem constraint. Dois `start` em paralelo (duas tabs, duplo clique, retry) criam duas sessões com `endedAt = null`. | Sessões sobrepostas corrompem heatmap, streak e totais (o próprio comentário na linha 172 diz isso). `getActive` passa a devolver uma qualquer. | Índice único parcial em SQL na migração: `CREATE UNIQUE INDEX ... ON "StudySession"("userId") WHERE "endedAt" IS NULL`, e apanhar P2002 no `start` como 409. | S | Baixo | sim, `--name study_session_one_active` (SQL manual) |
| B-24 | Medium | notebook (pesquisa) | `notebook/notebook.service.ts:1366-1414` | A pesquisa da paleta (Ctrl+K, a cada tecla com debounce) lê TODAS as entradas do user com `textContent` completo e filtra em JS. Depois, para até 50 resultados, carrega a entrada completa (JSON de desenho, tabelas, canvas) e assina URLs de todas as fotos e anexos no Supabase Storage. | Custo proporcional a todo o caderno por tecla. A segunda fase manda para a paleta centenas de KB que ela não mostra e faz pedidos HTTP ao Storage. | Filtrar no SQL (`contains` + `mode: 'insensitive'` em `title`/`textContent`, `take: 50`); a prazo `pg_trgm` com índice GIN. Na segunda fase devolver só resumo (id, título, data, área, preview) sem assinar URLs; a entrada completa vem de `GET /notebook/entries/:id` ao abrir. | M | Médio (a pesquisa por data dd/mm/aaaa tem de ser mantida à parte) | opcional, `--name notebook_search_trgm` |
| B-25 | Medium | tasks (reordenar) | `tasks/tasks.service.ts:323-334`; `tasks/dto/reorder-tasks.dto.ts:19` | `reorder` faz um `task.update` por id dentro de uma transação, e o DTO aceita até 2000 ids. Cada update é `where: { id }` sem `userId`. | Até 2001 statements numa transação por cada drag-and-drop; locks em muitas linhas durante a transação; latência alta no arrastar. | Um só `UPDATE "Task" t SET "sortOrder" = v.ord FROM unnest($1::text[], $2::int[]) AS v(id, ord) WHERE t.id = v.id AND t."userId" = $3` com `$executeRaw`. | M | Médio (SQL manual, testar) | não |
| B-26 | Medium | tasks (import Excel/CSV) | `tasks/tasks.service.ts:1226-1244`, `:1263-1283` | Cada linha válida é um `task.create` separado (concorrência 10, até 500 linhas). Além disso o `data` não define `sortOrder`, por isso todas as tasks importadas ficam com 0 e saltam para o topo da lista manual, o contrário do que `create()` garante (linhas 196-203). | Até 500 INSERTs e 10 ligações do pool ocupadas durante o import. Bug visível: a ordem manual do user é baralhada após cada import. | `createManyAndReturn` (Prisma 6) num só statement, com `sortOrder` = max atual + 1 + índice da linha. Mantém o sucesso parcial porque a validação já é feita antes em memória. | S | Baixo | não |
| B-27 | Medium | task-packs (import) | `task-packs/task-packs.service.ts:270-321`, `:350-397` | Cada item chama `tasksService.create` (área, tipos 1-2, período, peso, aggregate do sortOrder, insert) e depois um `task.update` só para gravar `packItemId`. Até 50 itens, tudo sequencial. No modo "substituir", `clearForReplace` apaga as tasks antigas ANTES de criar as novas, fora de qualquer transação. | Cerca de 8 a 9 queries por item, até ~450 sequenciais por import. Se os creates falharem (peso, período, erro transitório), as tasks antigas já foram apagadas e não voltam. | Passar `packItemId`/`packItemVersion` no próprio create (eliminar o update extra); pré-carregar área, tipos e orçamento de peso uma vez; no modo substituir, apagar só depois dos creates terem sucesso, ou tudo numa `$transaction` interativa. | M | Médio | não |
| B-28 | Medium | course-risk / cron | `course-risk/course-risk.service.ts:306-311`, `:466-480`; `reminders/grade-almost-there-reminders.service.ts:85-109` | `overview` faz um `classOccurrence.groupBy` por grupo cadeira+período dentro de `Promise.all` (N+1). O cron "quase lá" chama `courseRisk.overview` (que já faz várias queries mais este N+1) para CADA user com push, todos os dias. | Por user: ~8 queries + 1 por cadeira. No cron: multiplicado pelo número de users com push, em série. Escala mal e ocupa o pool na janela do cron. | Um só `groupBy` por `subject, attended` com `subject in` todos os textos e janela do período mais antigo; repartir em memória. No cron, pré-filtrar users com tasks/componentes com peso no período ativo antes de chamar `overview`. | M | Baixo | não |
| B-29 | Medium | tasks (consistência de escritas) | `tasks/tasks.service.ts:957-985`, `:1019-1027`, `:1030-1042`, compare com `:629-632` | Concluir pelo PATCH chama `spawnFollowUps` e `unblockDependents`. Concluir pelo overdue check-in (`confirmOverdue`) não chama `unblockDependents`. Concluir em massa (`bulkUpdateStatus`) não chama nenhum dos dois. O caminho "reabrir em massa" faz dois `updateMany` fora de transação. | Tasks dependentes ficam bloqueadas para sempre quando a bloqueadora é concluída pelo check-in ou em massa; séries recorrentes concluídas em massa acabam (o B-01 corrigido cobriu só o check-in). Reabrir em massa pode ficar meio aplicado. | Chamar `unblockDependents` em `confirmOverdue`; em `bulkUpdateStatus` COMPLETED, ler ids afetados, `updateMany` de desbloqueio por `blockedByTaskId in ids` e gerar recorrências; embrulhar os dois `updateMany` numa `$transaction`. | M | Médio | não |
| B-30 | Low | schema (índices redundantes) | `schema.prisma:981`, `:1211`, `:1283`, `:1633`, `:1705`, `:2499`, `:2515`, `:2684`, `:2713`, `:2745` | Índices cobertos por outro que começa pelas mesmas colunas: `Task[userId]` (coberto por `[userId, sortOrder]`, `[userId, date]`, `[userId, periodId, ...]`), `StudySession[userId]` (por `[userId, startedAt]`), `ClassOccurrence[userId]` (por `@@unique([userId, externalUid])` e `[userId, date]`), `WorkShift[userId]` (por `[userId, date]`), `Commitment[userId]` (por `@@unique([userId, name])`), `TurmaPack[turmaId]` (por `@@unique([turmaId, packId])`), `TurmaLinkedArea[turmaId]` (por `@@unique([turmaId, userId, areaId])`), `FinanceAccount/FinanceHolding/FinanceGoal[userId]` (por `@@unique([userId, clientRequestId])`). | Escritas mais caras (Task tem 13 índices) e espaço desperdiçado, sem ganho de leitura. | Remover estes `@@index`. Confirmar antes com `pg_stat_user_indexes` em produção que `idx_scan` é ~0. | S | Baixo | sim, `--name drop_redundant_indexes` |
| B-31 | Low | schema / areas | `areas/areas.service.ts:88-102` | O nome único de Área oficial (sem maiúsculas) é verificado com `findFirst` e depois cria/aprova, sem constraint. | Dois admins (ou aprovação + criação em simultâneo) podem gerar duas Áreas oficiais com o mesmo nome. | Índice único parcial em SQL: `ON "Area"(lower(name)) WHERE "ownerId" IS NULL`; tratar P2002 como 409. Limpar duplicados antes. | S | Médio (dados existentes) | sim, `--name area_official_name_unique` (SQL manual) |
| B-32 | Low | admin/users | `users/users.service.ts:49-54` | `findAll` (admin) devolve todos os users, sem `take` nem paginação. | Cresce sem limite; resposta pesada no painel admin. E-14 tratou feedback e friend-codes, não esta lista. | Paginação por cursor (`listOrPage`) e pesquisa no servidor. | S | Baixo | não |
| B-33 | Low | study-sessions (agregações) | `study-sessions/study-sessions.service.ts:481-484`, `:626-639`, `:690-702` | `getHeatmap`, `getTimeByArea` e `getStreak` leem TODAS as sessões terminadas do user (desde sempre) e agregam em JS. `getTimeByArea` faz ainda join a `area` e `task.area` por sessão e não tem cache; `getStreak` corre em cada carregamento do Dashboard/Focus. | Custo cresce com o histórico (anos de sessões por pedido). | `$queryRaw` com `GROUP BY` (dia da semana/hora em Lisboa, área resolvida com `COALESCE`) e, para a streak, `SELECT DISTINCT` do dia de Lisboa. | M | Baixo | não |
| B-34 | Low | prediction / study-plan | `prediction/prediction.service.ts:211-225`, `:569-572`, `:612`; `study-plan/study-plan.service.ts:656` | Carregam todas as tasks concluídas do user com as respetivas sessões aninhadas (`studySessions` em `select`), sem janela nem `take`, a cada pedido. | Histórico completo em memória por pedido; cresce com o uso. | Limitar a uma janela (ex.: últimos 12 meses ou últimas N amostras por `completedAt desc`) e somar a duração das sessões no SQL. | M | Médio (muda a amostra dos modelos) | não |
| B-35 | Low | task-packs (publicar) | `task-packs/task-pack-sync.service.ts:164-183`, `:281-314` | `publish` faz um `task.findMany` por item alterado (N+1). `linkLegacyItems` faz por item um `findMany` e um `updateMany` sobre tasks de TODOS os users por título+data, e repete em cada publicação para itens que nunca encontraram origem (`sourceTaskId` fica null). | Até 50 queries extra por publicação e um `updateMany` entre utilizadores repetido para sempre. | Um só `findMany` com `packItemId: { in: [...] }`; marcar itens legados já tentados (ex.: flag ou versão) para não voltar a procurar. | S | Baixo | não (ou sim se se acrescentar flag, `--name pack_item_legacy_checked`) |
| B-36 | Low | grade-components / tasks | `grade-components/grade-components.service.ts:155-169`; `tasks/tasks.service.ts:1170-1175` | `weightBudgets` e o import calculam o peso usado com `loadUsedWeight` por cadeira dentro de `Promise.all` (N+1). | Uma ida à BD (ou mais) por cadeira do período. | `groupBy` por `areaId` em tasks e componentes do período, uma vez. | S | Baixo | não |
| B-37 | Low | turmas | `turmas/turma-linked-areas.service.ts:38-49` | Um `notebookEntry.count` por cadeira partilhada na turma (até ao limite de 200 do C-17). | Até 200 queries em paralelo por abertura do separador, ocupa o pool. | `notebookEntry.groupBy({ by: ['userId','areaId'], where: { privateFromFriends: false, OR: links } , _count })`. | S | Baixo | não |
| B-38 | Low | area-ratings | `area-ratings/area-ratings.service.ts:99-114` | `syncSameTeacher` faz um `upsert` por cadeira com o mesmo docente em `Promise.all` e depois um `deleteMany`, sem transação. | Escritas parciais se uma falhar; N queries. | `$transaction([...upserts, deleteMany])`. | S | Baixo | não |
| B-39 | Low | reminders (cron) | `reminders/reminders.service.ts:120-161` | A query pega até 1000 tasks da janela de 72 h ordenadas por data, incluindo as já lembradas (o filtro de `sentReminders` é em memória) e as que ainda não chegaram à hora do lembrete. | Com muito volume, as 1000 primeiras podem ser todas já enviadas e as seguintes nunca são processadas. Também relê todos os dias as mesmas linhas com joins a user e push. | Reduzir a janela à hora de lembrete (até `now + 24h` mais a margem do "dia antes às 09:00") e excluir no SQL as que já têm `SentReminder` para a data (`sentReminders: { none: {...} }` por cada fase). | S | Baixo | não |
| B-40 | Low | push / crons | `push/push.service.ts:360-375`; `personal-notes/personal-notes.service.ts:127-145`; `reminders/reminders.service.ts:210-248` | Cada `notifyUser` faz duas queries (subscrições e `mutedPushKinds` do user). Os crons chamam-no em série, um user ou uma nota de cada vez. | 2 queries extra por notificação; crons mais lentos em escala. | Ler as subscrições com `include: { user: { select: { mutedPushKinds: true } } }` numa só query; nos crons, agrupar notas por user. | S | Baixo | não |
| B-41 | Low | tasks | `tasks/tasks.service.ts:988-994` | `remove` chama `findOne`, que carrega o `TASK_INCLUDE` completo (área, tipo, subtipo, prioridade, subtasks, contagem de anexos), só para confirmar que existe. | Query pesada desnecessária em cada apagar. | `deleteMany({ where: { id, userId } })` e 404 se `count === 0` (anexos já vêm por userId). | S | Baixo | não |
| B-42 | Low | tasks (escritas não atómicas) | `tasks/tasks.service.ts:185-226`, `:199-203`, `:716-744` | `assertWeightFits` e depois `create` (dois pedidos em paralelo podem passar os 100% da cadeira); `aggregate` do `sortOrder` máximo e depois `create` (sortOrder repetido). | Pesos acima de 100% em corridas; ordem manual com empates. | `$transaction` interativa com isolamento `Serializable` ou lock por user (`pg_advisory_xact_lock(hashtext(userId))`) à volta de validação e insert. | M | Médio | não |
| B-43 | Low | ownership (regra do projeto) | `academic-programs/programs.service.ts:92`; `areas/areas.service.ts:275`; `grade-components/grade-components.service.ts:279`, `:337`; `notebook/notebook.service.ts:582`, `:1144`; `tasks/subtasks.service.ts:98`; `tasks/tasks.service.ts:329`, `:743`; `study-sessions/study-sessions.service.ts:797`; `turmas/turma-*.service.ts` (deletes por `id`) | Escritas com `where: { id }` sem `userId`. Em todos os casos há uma verificação de posse antes (não é IDOR hoje), mas viola a regra "userId em todas as queries" e depende do check anterior. | Risco de IDOR se um refactor remover o check; padrão check-then-act. | Trocar por `deleteMany`/`updateMany` com `{ id, userId }` (ou `where: { id, userId }` em `update`/`delete`, como já se faz em `tasks.service.ts:586`). | S | Baixo | não |
| B-44 | Low | grade-components | `grade-components/grade-components.service.ts:320-338` | `updateEntry` e `removeEntry` chamam `findOwnedOrThrow` duas vezes no mesmo pedido (antes e depois da escrita) mais `assertEntryInComponent`. | 4 queries onde 2 chegam. | Validar com um só `gradeEntry.findFirst({ where: { id, componentId, component: { userId } } })` e recarregar o componente uma vez. | S | Baixo | não |
| B-45 | Low | notebook (legado) | `notebook/notebook.service.ts:299-348`; `common/pagination.util.ts:8` | `findAllForArea` sem paginação devolve até 1001 entradas completas (JSON de desenho, tabelas, canvas) e assina todas as fotos e anexos. O próprio comentário (linhas 351-358) diz que só existe para um frontend antigo. | Resposta de vários MB e muitos pedidos ao Storage se ainda for chamado. | Confirmar no frontend se ainda há chamadas; se não, retirar a rota ou forçar paginação. | S | Baixo | não |
| B-46 | Low | study-sessions (memória) | `study-sessions/study-sessions.service.ts:157-160`, `:521` | `heatmapCache` é um `Map` por processo que só perde entradas quando o user escreve uma sessão; nunca expira por tamanho. Com várias instâncias no Render cada uma tem a sua cópia. | Memória cresce com o número de users ativos; resultados diferentes entre instâncias durante o TTL. | LRU com tamanho máximo, ou eliminar a cache depois de B-33 (agregação em SQL). | S | Baixo | não |
| B-47 | Low | reminders (cron faltas) | `reminders/absence-limit-reminders.service.ts:131-148`, `:179-187` | Um `classOccurrence.groupBy` por user com push, em série. | N queries por execução no dia de envio; aceitável hoje graças a `evaluatedNoRisk`, mas cresce com os users. | Um `groupBy` por página de users (`userId in [...]`, `by: ['userId','subject','attended']`) com a janela do período de cada um filtrada em memória. | M | Baixo | não |

#### Notas dos achados B (detalhe de B-22, B-23, B-26, B-29, B-30)

##### B-20
O export de finanças já tem limite próprio (`FINANCE_EXPORT_PER_MINUTE = 10`, `finance/finance.constants.ts:17`); o export completo, muito mais pesado, não. O E-09 do relatório de silent bugs tornou o export completo (mais tabelas), o que agravou este custo sem o limitar.

##### B-22: colunas FK sem índice que comece por elas
Confirmadas no schema (linha da relação) e, quando aplicável, na query que as usa:

- `Feedback.userId` (`schema.prisma:1983`, SetNull) usado em `users.service.ts:284`.
- `Pad.updatedById` e `Pad.lockedById` (`schema.prisma:2339-2340`, SetNull); `updatedById` usado em `users.service.ts:409`.
- `TurmaNote.createdById`, `TurmaNote.updatedById` (`schema.prisma:2441-2442`, SetNull); `createdById` usado em `users.service.ts:421`.
- `TurmaFile.uploadedById` (`schema.prisma:2461`) usado em `users.service.ts:432`.
- `TurmaAnnouncement.authorId` (`schema.prisma:2477`) usado em `users.service.ts:443`.
- `TurmaPack.sharedById` (`schema.prisma:2496`, Cascade) usado em `users.service.ts:457`; `TurmaPack.packId` (`schema.prisma:2495`, Cascade ao apagar um TaskPack).
- `TurmaProgram.sharedById` (`schema.prisma:2763`, Cascade).
- `TurmaLinkedArea.userId` e `.areaId` (`schema.prisma:2511-2512`, Cascade); `userId` usado em `users.service.ts:453`. O único índice começa por `turmaId`.
- `TurmaInvite.invitedById` (`schema.prisma:2402`), `Turma.createdById` (`:2377`), `TurmaDeadline.createdById` (`:2787`).
- `ShareVisit.viewerUserId` (`schema.prisma:1945`, SetNull).
- `NotebookEntry.areaId` sozinho (`schema.prisma:1463`, Cascade ao apagar Área; o índice existente começa por `userId`) e `NotebookEntry.classOccurrenceId` (`:1464`, SetNull ao apagar aulas, que acontece em cada reimportação de horário).
- `AreaScheduleLink.areaId` (`schema.prisma:1305`, Cascade; índice existente é `[userId, areaId]`).
- `GradeComponent.periodId` (`schema.prisma:1791`, Cascade ao apagar período; índice existente é `[userId, periodId]`).
- `FinanceHolding.accountId` (`schema.prisma:2710`, SetNull ao apagar conta).
- `User.activeProgramId`, `User.activePeriodId`, `User.statusUpdatedByUserId` (`schema.prisma:337`, `:339`, `:287`, SetNull: apagar um programa ou período percorre a tabela User).
- `UserAppeal.resolvedByUserId` (`:506`), `BannedIp.bannedByUserId` (`:1153`), `PadBlockedSource.blockedById` (`:2355`).
- `Task.priorityId` (`schema.prisma:846`): só pesa quando o admin apaga uma prioridade; baixa prioridade.

Sugestão: na mesma migração `fk_indexes`, priorizar as que correm no apagar conta e no export (as primeiras sete linhas da lista) e `NotebookEntry.classOccurrenceId`.

##### B-23
Não há suporte declarativo a índices parciais no Prisma 6; a migração tem de ser criada com `--create-only` e o SQL acrescentado à mão. O mesmo vale para B-31 e para a variante parcial de B-21.

##### B-26
O facto de as tasks importadas ficarem com `sortOrder = 0` é um bug funcional (não está no relatório de silent bugs). A correção de eficiência (`createManyAndReturn`) resolve os dois de uma vez.

##### B-29
Relaciona-se com B-01 (já corrigido: o check-in passou a gerar a próxima ocorrência), mas o desbloqueio de dependentes e o caminho em massa ficaram de fora. É uma inconsistência funcional, não só de eficiência; incluída porque o pedido cobre "transações em falta onde há várias escritas".

##### B-30
Antes de remover, correr em produção:
`SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan;`
Os índices compostos que os cobrem ficam; só saem os de uma coluna listados.

### 4.2 Qualidade do backend: DTO, throttle, testes, duplicação (S-01 a S-37)

Pontos fortes confirmados pelo agente: ValidationPipe global com whitelist e forbidNonWhitelisted (main.ts:130-136); todos os @Body usam DTO; nenhum IDOR encontrado (todas as escritas só por id são precedidas de verificação de posse, ver S-37); Swagger desligado em produção; 23 services sem spec direto (S-04, S-18, S-36).

| ID | Gravidade | Área | Ficheiro:linha | O que está mal | Impacto | Correção proposta | Esforço | Risco da correção | Migração |
|---|---|---|---|---|---|---|---|---|---|
| S-01 | High | (6) Duplicação divergente | `tasks/tasks.service.ts:1013-1043`; comparar com `tasks/tasks.service.ts:624-631` | `bulkUpdateStatus` marca COMPLETED com `updateMany` e não chama `spawnFollowUps` nem `recordChanges`, ao contrário de `update()`. No ramo que não é COMPLETED, faz dois `updateMany` fora de `$transaction`. | "Marcar como feitas" em massa (`PATCH /tasks/bulk-status`, `tasks.controller.ts:105`) termina em silêncio as séries recorrentes, não cria as revisões espaçadas e não grava histórico. É a mesma classe de bug que o B-01, mas noutro caminho. | Extrair um `applyCompletionSideEffects(userId, tasks)` partilhado: depois do `updateMany`, carregar as tasks afetadas e chamar `spawnFollowUps` e `recordChanges`. Embrulhar os dois `updateMany` num `$transaction`. | M | Médio (toca no streak e na recorrência) | não |
| S-02 | High | (7) Acoplamento | `turmas/turma-deadlines.service.ts:136-145`; comparar com `tasks/tasks.service.ts:505-514` e `:624` | Editar um prazo da turma faz `prisma.task.updateMany` direto nas tasks de outros utilizadores. Isto salta o `TasksService`: não há `assertWeightFits`, nem histórico (`TaskChange`), nem as regras de `postponedCount` do `update()`. | O peso total de uma cadeira de outro membro pode passar 100% sem aviso. A mudança de data não aparece no histórico da task. | Criar um método `TasksService.applyLinkedDeadlineChange(taskIds, changes)` que valida o peso por utilizador e área e grava o histórico. Usá-lo no `turma-deadlines.service`. | M | Médio | não |
| S-03 | High | (2) Throttle / (8) Payload | `users/users.controller.ts:46` e `:130`; `users/users.service.ts:198-486` | Os exports RGPD `GET /users/me/export` e `GET /users/:id/export` não têm `@Throttle`. Cada chamada faz cerca de 45 `findMany` sem `take` e devolve tudo num só JSON. Os exports de finanças (`finance.controller.ts:87`) e de atividade de segurança (`security-activity.controller.ts:19`) têm limite próprio. | Um utilizador pode pedir até 100 exports completos por minuto (o limite global). Isto pesa na BD e na memória do processo do Render. | `@Throttle(perMinute(2))` nos dois endpoints, com uma constante `DATA_EXPORT_PER_MINUTE`. | S | Baixo | não |
| S-04 | High | (4) Testes em falta | `auth/services/two-factor.service.ts` (288 linhas); `auth/services/totp.util.ts` (111); `auth/services/oauth-identity.service.ts` (356); `auth/oauth-merge.policy.ts` (56); `auth/services/api-key.service.ts` (145) | Nenhum destes ficheiros tem spec. Pesquisei `TwoFactor`, `verifyTotp`, `neutralizePreexistingCredential`, `ApiKeyService` e `GradeComponentsService` nos `*.spec.ts`: zero resultados. | Código de autenticação (2FA, TOTP, fusão de contas OAuth, API keys) sem rede de segurança. Uma regressão abre contas ou deixa utilizadores sem acesso. | Specs unitários. Casos para o TOTP: janela de ±1 passo e reutilização de código. Para os recovery codes: uso único. Para o merge: falha a fechar quando o Supabase dá erro. Para as API keys: scope ADMIN só para admins, e revogar uma key de outro utilizador. | M | Baixo | não |
| S-05 | Medium | (7) Acoplamento | `turmas/turma-programs.service.ts:253-290` (`tx.area.create`); `turmas/turma-programs.service.ts:14`; `areas/areas.service.ts:20` e `:108-113` | Importar um programa partilhado cria Áreas, Programas e Períodos diretamente na transação. Salta `MAX_PRIVATE_AREAS_PER_USER = 50`, porque um snapshot aceita até `MAX_SNAPSHOT_COURSES = 200`. `programs.service.ts` e `periods.service.ts` não têm nenhum teto por utilizador. | Um import pode deixar o utilizador com mais de 50 Áreas privadas. Programas e períodos podem crescer sem limite (até 60 imports por minuto, `TURMA_WRITES_PER_MINUTE`). | Contar as Áreas antes da transação e recusar se `existentes + novas > 50`. Acrescentar `MAX_PROGRAMS_PER_USER` e `MAX_PERIODS_PER_PROGRAM`, aplicados nos services e no import. | S | Baixo | não |
| S-06 | Medium | (2) Throttle | `auth/auth.controller.ts:706-745` | O upload do avatar não tem `@Throttle`, só o limite global de 100 por minuto. O próprio código diz que todos os uploads precisam de limite próprio (`notebook/notebook.controller.ts:293-297`), e as fotos, os anexos e os ficheiros de turma já o têm. | Até 100 uploads de 5 MB por minuto por IP, todos com buffer em memória e escrita no Storage. | `@Throttle(perMinute(10))`, partilhando a constante com os outros uploads (ver S-29). | S | Baixo | não |
| S-07 | Medium | (2) Throttle / (3) Lógica no controller | `calendar/calendar.controller.ts:33-82` | `POST` e `DELETE /calendar/tasks/:taskId/sync` não têm throttle e chamam a API do Google. O controller injeta `PrismaService` e faz o `findFirst` de posse e o `task.update` ele próprio. | Gasta a quota da Google API do projeto e cria eventos repetidos. A regra de negócio fica fora do service e não é testável. | Mover para `CalendarService.syncTask(userId, taskId)` e `unsyncTask(...)`, usando o helper de posse do S-28. Acrescentar `@Throttle(perMinute(20))`. | S | Baixo | não |
| S-08 | Medium | (1) DTO / (2) Throttle / (8) Payload | `notebook/notebook.controller.ts:413-421`; `notebook/notebook.service.ts:1366-1413` | `GET /notebook/search` recebe `@Query('q') q: string` sem DTO, sem `@MaxLength` e sem throttle. O service lê `textContent` de todas as entradas do utilizador a cada pedido (a paleta chama-o a cada tecla, com debounce). Depois devolve até 50 entradas completas: desenhos, tabelas e canvas em JSON, mais URLs assinados das fotos. A pesquisa das turmas já usa `SearchTurmaNotesQueryDto` com `SEARCH_QUERY_MAX_LENGTH`. | Pedidos pesados e repetidos. As respostas grandes enchem a paleta de dados que ela não mostra. | Criar um DTO com `@MaxLength(200)` e `@Throttle(perMinute(60))`. Filtrar em SQL (`contains` com `mode: 'insensitive'` e `take`) e devolver só um resumo: id, título, área e data. O índice trigram fica para o relatório de schema. | M | Baixo | não |
| S-09 | Medium | (8) Ineficiência | `auth/services/api-key.service.ts:93-121`; `auth/strategies/api-key.strategy.ts:20` | Cada pedido com `x-api-key` corre `scrypt` (64 bytes) e um `apiKey.update` de `lastUsed`, sem cache nenhuma. O agente Go faz poll periódico. Uma key inválida enviada por qualquer cliente também gasta `scrypt` nas rotas com `JwtOrApiKeyAuthGuard`. | CPU e escritas na BD a cada pedido. É um vetor de DoS barato: 100 pedidos de scrypt por minuto por IP. | Cache LRU curta (cerca de 60 s) de `keyHash` para utilizador e scope, invalidada no revoke. Gravar `lastUsed` só se tiverem passado mais de 5 minutos. Limite próprio para falhas de API key. | M | Médio (a invalidação no revoke tem de ser imediata) | não |
| S-10 | Medium | (2) Rate limit auth | `auth/auth.controller.ts:224-238`; `auth/services/two-factor.service.ts:91-116` | O 2.º passo do login 2FA só tem 10 tentativas por minuto por IP. Não há contador de tentativas por desafio nem por conta, e o desafio vale 5 minutos (`CHALLENGE_TTL`). Só se aplica com `TWO_FACTOR_ENABLED`. | Com a password e IPs rotativos, o código de 6 dígitos pode ser forçado com uma probabilidade baixa mas real. | Contador em memória por `userId` (ou pelo `jti` do desafio): invalidar o desafio ao fim de 5 falhas e registar um SecurityLog. | S | Baixo | não (ou sim, se quiser o contador persistente: `--name two_factor_attempts`) |
| S-11 | Medium | (2) Rate limit email / (9) Fuga | `auth/services/password-auth.service.ts:335-372`; comparar com `auth/services/email-verification.service.ts:18` e `:113-114` | `forgot-password` só tem 3 pedidos por minuto por IP e nenhum cooldown por email, ao contrário do `resend-verification` (`RESEND_COOLDOWN_MS`). Há também uma diferença de tempo: uma conta local só-OAuth devolve logo (envio em background), enquanto o resto espera pelo `generateLink` do Supabase. | Com IPs rotativos dá para inundar de emails a caixa de uma vítima. A diferença de tempo pode revelar se existe uma conta só-OAuth com esse email. | Cooldown por email normalizado (mesmo padrão do `lastSentAt`). Correr o `generateLink` também em `runInBackground`, para que os dois caminhos respondam no mesmo tempo. | S | Baixo | não |
| S-12 | Medium | (2) Throttle social/push | `notebook/notebook.controller.ts:244`; `notebook/notebook.service.ts:779-825` | `decideAccessRequest` não verifica se o pedido já foi decidido (só bloqueia convites pendentes, `:795-799`) e envia um push a cada decisão. A rota não tem throttle. `decideProposal` recusa decisões repetidas (`notebook-collab.service.ts:254-256`). | O dono pode alternar APPROVED e DENIED e mandar até 100 pushes por minuto a quem pediu acesso. | Enviar o push só quando o estado muda, e acrescentar `@Throttle(perMinute(30))`. Manter a mudança de papel sem push. | S | Baixo | não |
| S-13 | Medium | (9) Dados pessoais em logs | `common/interceptors/request-user-logger.interceptor.ts:46-52`; `auth/auth.controller.ts:927-929` e `:964-966` | Cada pedido autenticado escreve o email do utilizador no log, também em produção (não há condição por ambiente). O log inclui a query string (por exemplo o `q` da pesquisa do caderno). Os dois logins também escrevem o email. | Dados pessoais e conteúdo pesquisado ficam guardados nos logs do Render, sem rotação controlada. | Escrever só `id` e `role` no log. Tirar a query string, ou fazer redact dos parâmetros conhecidos. Pôr o interceptor atrás de `LOG_REQUESTS=true` em produção. | S | Baixo | não |
| S-14 | Medium | (9) Tratamento de erros | `main.ts` (não há `useGlobalFilters`); `auth/services/api-key.service.ts:139-143`; `schedule/schedule.controller.ts:67-79` | Não há nenhum filtro global para erros do Prisma: todos acabam em 500. Exemplos confirmados: `DELETE /auth/api-keys/<id inexistente>` (o `delete` dá P2025), `GET /schedule?from=lixo` (Date inválida) e inteiros fora do intervalo int4 (S-19). Cada service define o seu `isUniqueViolation` (S-27). | Erros do cliente aparecem como falhas do servidor e enchem o log de erros. O frontend não consegue distinguir 404 e 409 de um 500. | `PrismaExceptionFilter` global: P2025 dá 404, P2002 dá 409, P2003 dá 409, `PrismaClientValidationError` dá 400. A mensagem é genérica e o detalhe fica só no log. | M | Médio (pode mudar códigos de erro que o frontend já espera) | não |
| S-15 | Medium | (1) DTO / (3) Lógica no controller | `schedule/schedule.controller.ts:34`, `:67-79`, `:90-104`, `:117-131`, `:190-205` | `from` e `to` chegam como `@Query` em string e são tratados no controller. `findRange` faz `new Date(from)` sem validar e sem teto de intervalo, por isso a resposta pode trazer todas as aulas. `attendance` e `study-vs-class` só testam a regex, e `2026-13-01` dá Date inválida e um 500. A lógica de cortar em "hoje" está copiada duas vezes. O `ects-workload` já faz isto bem, com um DTO e `isRealDateKey` (`schedule/dto/ects-workload-query.dto.ts`). | 500 com input do cliente, payload sem limite, e regras repetidas no controller. | Criar um `DateRangeQueryDto` com validação de dia real (`isRealDateKey`), um teto de dias como o `ECTS_MAX_RANGE_DAYS`, e mover o corte em "hoje" para o service. | S | Baixo | não |
| S-16 | Medium | (3) Lógica no controller | `auth/auth.controller.ts` (1006 linhas): `:591-645`, `:776-916`, `:922-970` | O controller injeta `PrismaService` e implementa sessões de dispositivo, rotação de cookies, upgrade de JWT antigo, revogação no logout e o perfil (`buildProfile`, `continueDeviceSession`, `keepOnlyCurrentDevice`, `revokeCurrentDevice`, `upgradeLegacySession`, `issueSessionAndRedirect`). | É o ficheiro mais sensível e o maior da app. As regras ficam presas ao `Response` do Express e só se testam com mocks de controller (`auth.controller.sessions.spec.ts`). | Extrair um `SessionCookieService` (emitir e limpar cookies, continuar ou adotar sessões) e um `ProfileService.build(userId)`. O controller fica só a orquestrar. | L | Médio (é o caminho de login) | não |
| S-17 | Medium | (8) Agregação sem teto | `study-sessions/study-sessions.service.ts:626-640` (via `study-sessions.controller.ts:126`); `prediction/prediction.service.ts:611-622` (via `prediction.controller.ts:24`) | `GET /study-sessions/time-by-area` lê todas as sessões de sempre com joins de área, a cada carregamento do Dashboard. `GET /predictions/accuracy` lê todas as tasks com estimativa e as suas sessões. Nenhum dos dois tem cache nem throttle, e ambos agregam em JS. O heatmap ao lado já tem cache. | O custo cresce com o histórico do utilizador. Com anos de uso, o Dashboard fica lento. | Agregar em SQL (`$queryRaw` com `SUM(EXTRACT(EPOCH FROM ended_at - started_at))` e `GROUP BY`), ou reutilizar a cache do heatmap. Juntar `@Throttle(perMinute(30))`. O índice composto fica para o relatório de schema. | M | Baixo | não |
| S-18 | Medium | (4) Testes em falta | `grade-components/grade-components.service.ts` (340); `users/users.service.ts:88-196` (update, suspend, ban, reactivate); `calendar/calendar.service.ts` (410: refresh de token e upsert de evento); `calendar/schedule-sync.service.ts` (486: só o builder e os feriados têm spec) | As notas e pesos, as ações de admin sobre contas e a sincronização com o Google não têm spec do service. A pesquisa nos `*.spec.ts` não encontra `GradeComponentsService`, `suspend`, `ban(` nem `CalendarService`. | Regressões nas médias, em bans, ou no refresh de tokens Google passam sem aviso. | Specs com o Prisma em mock: BEST_OF e peso nos componentes; admin a não poder banir-se a si próprio, invalidação de cache e auditoria em `users`; refresh 401 e a reconexão no Calendar. | M | Baixo | não |
| S-19 | Low | (1) DTO números | `academic-programs/dto/create-program.dto.ts:35-37`; `priorities/dto/create-priority.dto.ts:40`; `task-types/dto/create-task-type.dto.ts:39`; `task-types/dto/create-academic-task-type.dto.ts:39`; `areas/dto/create-area.dto.ts:47`; `notebook/dto/upsert-notebook-entry.dto.ts:289` e `:390`; `security-logs/dto/purge-security-logs.dto.ts:15` | `@IsInt()` sem `@Max` em colunas `Int` (`order`, `credits` e `classNumber` no `schema.prisma`). `olderThanDays` sem teto acaba numa Date inválida. | Um valor acima de 2^31 dá um 500 do Postgres (integer out of range). | `@Max` com um limite de negócio (por exemplo 10 000 para `order`, 100 para `credits`, 3650 para `olderThanDays`). | S | Baixo | não |
| S-20 | Low | (1) DTO / (6) Duplicação | `study-sessions/study-sessions.controller.ts:56-64` e `:132-140`; `study-plan/study-plan.controller.ts:44-54`; `calendar/schedule-sync.controller.ts:44-53`; `finance/finance.controller.ts:73-78`; `areas/areas.controller.ts:134-144`; `calendar/feed/calendar-feed.controller.ts:84-87` | `@Query('days')`, `month`, `periodId`, `includeHidden` e `only` chegam como string sem DTO. O parse e o clamp de `days` estão copiados quatro vezes, com defaults diferentes, e a validação de `month` vive no service (`finance.service.ts:184-188`). | Validação espalhada e inconsistente: por exemplo, `history` aceita `days=1e9` e só o service corta. | Criar um `DaysQueryDto` (com `@Type(() => Number)`, `@IsInt`, `@Min`, `@Max` e default) e DTOs para `month` (`@Matches`), `periodId` (`@IsUUID` ou `'all'`) e `only` (`@IsIn(FEED_SCOPES)`). | S | Baixo | não |
| S-21 | Low | (1) Param sem validação / (10) | `users/users.controller.ts:122`; `users/users.service.ts:12` e `:76-80` | `@Param('provider')` só está tipado como `'google' \| 'github' \| 'discord'`, sem validação. Com um valor desconhecido, `PROVIDER_MAP[provider]` dá `undefined`, o Prisma ignora o filtro e a rota devolve a primeira identidade de qualquer provider. | `GET /users/:id/providers/xyz` diz "ligado" quando não está. O dado é do próprio utilizador ou de um admin, por isso não é uma fuga entre contas. | `ParseEnumPipe` ou um DTO com `@IsIn(['google','github','discord'])`. | S | Baixo | não |
| S-22 | Low | (1) Params | `academic-programs/periods.controller.ts:47-111`; `academic-programs/programs.controller.ts:58-112`; `tasks/tasks.controller.ts:174-202`; `tasks/subtasks.controller.ts:38-97`; `study-sessions/study-sessions.controller.ts:70-172`; `calendar/calendar.controller.ts:36` e `:62`; `banned-ips/banned-ips.controller.ts:46`; `auth/auth.controller.ts:1001`; `quizzes/quizzes.controller.ts:140` | Cerca de 35 `@Param('id')` sem `ParseUUIDPipe`. A maior parte dos outros controllers já o usa. | Inconsistência: ids sem tamanho máximo chegam à BD, e há 500 onde o service não faz um `findFirst` antes (S-14). | Pôr `ParseUUIDPipe` em todos os ids. | S | Baixo | não |
| S-23 | Low | (1) DTO strings | `auth/dto/forgot-password.dto.ts:10`; `auth/dto/verify-email.dto.ts:17`; `turmas/dto/turma.dto.ts:96` | `@IsEmail` sem `@MaxLength(EMAIL_MAX_LENGTH)`, ao contrário do `register.dto.ts:23` e do `login.dto.ts`. | Pouco: o `isEmail` já limita o tamanho. Fica a incoerência. | Usar `EMAIL_MAX_LENGTH` de `auth/dto/auth-limits.ts`. | S | Baixo | não |
| S-24 | Low | (3) Lógica no controller | `account-status/account-status.controller.ts:33-66` | O controller faz duas queries Prisma (`user` e `userAppeal`), apesar de já existir o `AccountStatusService` no mesmo módulo. | Lógica fora do service e sem teste. É feito poll deste endpoint por todos os utilizadores. | Criar `AccountStatusService.getMyStatus(userId)`. | S | Baixo | não |
| S-25 | Low | (3) Regras no controller | `users/users.controller.ts:161`, `:182`, `:210` e `:227`; `feedback/feedback.controller.ts:77`; `reminders/reminders.controller.ts:18-23` e `:42-45` | As regras "não te podes despromover, suspender, banir ou silenciar a ti próprio" e a validação do `CRON_SECRET` estão no controller. | Um novo caminho para o service (por exemplo com API key ADMIN) salta as regras. | Passar o `adminId` aos services e validar lá. Mover a verificação do segredo de cron para um guard (`CronSecretGuard`). | S | Baixo | não |
| S-26 | Low | (6) Duplicação | `auth/guards/csrf.guard.ts:25-35`; `auth/guards/oauth-guard.helpers.ts:70-85`; `auth/services/user-sessions.service.ts:79-83`; `reminders/reminders.controller.ts:18-23`; `social/friend-links.service.ts:236` | A comparação de strings em tempo constante está implementada 5 vezes, com duas variantes. | É fácil uma cópia futura esquecer o caso de tamanhos diferentes (o `timingSafeEqual` lança exceção). | Criar `common/safe-equal.util.ts` com um `safeEqual(a, b)` testado. | S | Baixo | não |
| S-27 | Low | (5) Constantes / (6) Duplicação | `finance/finance.service.ts:104`; `pads/pads.service.ts:58`; `reminders/sent-notification.constants.ts:27`; `study-sessions/streak-freezes.service.ts:24`; `turmas/turmas.service.ts:24` e `:34`; `wellbeing/medications.service.ts:87` e `:89`; `work-shifts/commitments.service.ts:58`; `grade-components/grade-components.service.ts:52`; `auth/services/oauth-identity.service.ts:159` | O código `'P2002'` está definido 7 vezes e o `isUniqueViolation` existe em 3 versões diferentes. | Manutenção, e deteção de erros inconsistente: uma versão verifica `instanceof`, as outras não. | Criar `common/prisma-errors.ts` (`isUniqueViolation`, `isNotFound`) e usá-lo também no S-14. | S | Baixo | não |
| S-28 | Low | (6) Duplicação de ownership | `calendar/calendar.controller.ts:38-44` e `:64-69`; `prediction/prediction.service.ts:150-156`; `study-sessions/study-sessions.service.ts:830-839`; `tasks/subtasks.service.ts:21`; `tasks/task-attachments.service.ts:174-179`; `tasks/tasks.service.ts:387`, `:404` e `:949` | A verificação "a task é minha?" está repetida pelo menos 7 vezes, com 3 mensagens diferentes. Para as Áreas já existe o helper único `areas/area-access.ts`. | Mensagens diferentes para o mesmo 404, e o risco de alguém esquecer o filtro `userId` numa cópia nova. | Criar `tasks/task-access.ts` com `assertTaskOwned(prisma, userId, taskId, select?)`, no mesmo modelo do `area-access.ts`. | S | Baixo | não |
| S-29 | Low | (5) Constantes / (6) Duplicação | `auth/auth.controller.ts:35`; `notebook/notebook.controller.ts:53`; `tasks/task-attachments.controller.ts:26` e `:32`; `turmas/turmas.controller.ts:65`; `notebook/attachment-validation.util.ts:29`; `common/upload-limits.ts` | O tipo `MulterLimitsWithFieldNestingDepth` e o bloco de limites do multer estão copiados 4 vezes. `ATTACHMENT_MAX_SIZE_BYTES` está fora do `upload-limits.ts`, que diz ser "um sitio so". Os limites de upload por minuto são 10, 10 (constante local), 20 e nenhum (avatar). | Incoerência, e o S-06 aconteceu precisamente por isto. | Criar um helper `singleFileUpload(field, maxBytes)` em `common/upload-limits.ts` e uma constante `UPLOADS_PER_MINUTE` comum. | S | Baixo | não |
| S-30 | Low | (5) Constantes | `auth/session.constants.ts:7`; `tasks/priority-suggestion.util.ts:19`; `account-status/account-status.service.ts:15`; `flashcards/flashcard-schedule.ts:6`; `notebook/notebook-invite.service.ts:15`; `quizzes/quizzes.constants.ts:14`; `reminders/reminders.service.ts:31`; `social/friend-code-requests.service.ts:11`; `social/friend-links.service.ts:15`; `study-plan/study-plan.service.ts:500`; `calendar/calendar.service.ts:280-281`; `calendar/feed/ics-feed.builder.ts:29`; `calendar/schedule-sync.constants.ts:14`; `turmas/turma-programs.service.ts:312` | Há 10 cálculos de milissegundos feitos à mão (`24 * 60 * 60 * 1000`, `86_400_000`, `3_600_000`), apesar de existir `common/time.constants.ts`. `'Europe/Lisbon'` está escrito 4 vezes em vez de `APP_TIME_ZONE`. O timeout de transação `30_000` é um literal. | Manutenção: mudar o fuso horário da app obriga a procurar literais. | Importar `MS_PER_DAY`, `MS_PER_HOUR` e `APP_TIME_ZONE`, e criar uma constante `LONG_TRANSACTION_TIMEOUT_MS`. | S | Baixo | não |
| S-31 | Low | (5) Constantes | 96 chamadas `perMinute(<número>)` em controllers (por exemplo 13 em `auth/auth.controller.ts`, 8 em `study-plan/study-plan.controller.ts`, 8 em `social/social.controller.ts`, 7 em `areas/areas.controller.ts`); `tasks/dto/bulk-reschedule.dto.ts:21`, `bulk-task-ids.dto.ts:16`, `bulk-update-effort.dto.ts:22`, `bulk-update-status.dto.ts:25` | Os limites de throttle são números soltos, enquanto outros módulos já usam constantes nomeadas (cerca de 40). O teto de 200 das operações em massa está repetido em 4 DTOs. | Não há um sítio único para rever os limites. O frontend tem de saber o 200 por conta própria. | Um `*.constants.ts` por módulo com os limites nomeados, e `TASK_BULK_MAX = 200` partilhado com o frontend. | S | Baixo | não |
| S-32 | Low | (6) Duplicação | `schedule/ects-workload.util.ts:16` (`isRealDateKey`); `finance/finance.service.ts:150-154` (`parseDay`); `schedule/schedule.controller.ts:34` (`DATE_KEY` copiado de `common/date-key.util.ts:14`) | Há três formas de validar "YYYY-MM-DD real", e o controller usa só a regex. | É a causa do 500 do S-15. | Mover o `isRealDateKey` para `common/date-key.util.ts`, criar um decorador `@IsRealDateKey()` e fazer o `parseDay` usá-lo. | S | Baixo | não |
| S-33 | Low | (8) Paginação | `users/users.service.ts:49-54` (via `users/users.controller.ts:59`) | `GET /users` (admin) devolve todos os utilizadores sem `take` nem paginação. | O payload cresce com a base de utilizadores. Hoje é pequeno. | Usar `PaginationDto` com skip e take, ou cursor como o `listOrPage`. | S | Baixo | não |
| S-34 | Low | (7) Estado por instância | `banned-ips/banned-ips.service.ts:29-39`; `auth/services/email-verification.service.ts:44`; `app.module.ts:62-67` (throttler com storage em memória) | O ban de IPs, o cooldown de emails e os contadores do throttler vivem na memória do processo. | Se o Render escalar para mais de uma instância: um ban não se propaga, os limites multiplicam-se e os cooldowns falham. Sem impacto com uma só instância. | Documentar o pressuposto de uma só instância. Se escalar: Redis para o throttler e invalidação por pub/sub, ou ler da BD com cache curta. | M | Baixo | não (Redis não é migração Prisma) |
| S-35 | Low | (9) Fuga de dados | `auth/filters/oauth-conflict-redirect.filter.ts:51-57` | O conflito de conta OAuth faz redirect com `?error=account_conflict&email=<email>` na query string. O fluxo de conta bloqueada já usa o fragmento `#` pela mesma razão (`:63-68`). | O email fica no histórico do browser, nos logs de acesso do Netlify e no Referer. | Mover o email para o fragmento (`#email=`), ou não o enviar e deixar o frontend mostrar uma mensagem genérica. | S | Baixo (ajustar o `AuthCallback.tsx`) | não |
| S-36 | Low | (4) Testes em falta | `prediction/prediction.service.ts` (718); `work-shifts/work-shifts.service.ts` (444); `banned-ips/banned-ips.service.ts` (76); `tasks/weekly-review.service.ts` (162); `wellbeing/wellbeing-insights.service.ts` (145); `turmas/turma-linked-areas.service.ts` (154); `turmas/turma-announcements.service.ts` (66); `task-types/task-types.service.ts` (170); `priorities/priorities.service.ts` (78); `agent/agent-config.service.ts` (77); `wellbeing/blood-donations.service.ts` (72); `area-interests/area-interests.service.ts` (37); `telemetry/telemetry.service.ts` (36) | Estes services não têm spec, nem direto nem por nome. Os utils de alguns deles têm. Ordem por risco: primeiro prediction e work-shifts (lógica), depois a cache dos banned-ips e o weekly-review, e por fim o CRUD trivial. | Baixo a médio. Nos CRUD triviais o ganho é pequeno. | Specs começando pelos três primeiros. Os CRUD triviais podem ficar cobertos por testes e2e. | M | Baixo | não |

## 5. Achados de arquitetura: frontend

### 5.1 Arquitetura, estado, bundle e duplicação (F-01 a F-61)

Contexto que condiciona as correcoes: o `api/client.ts:24` so faz dedupe de GETs em voo (`api/dedupeGets.ts`), sem cache nem invalidacao. Nao existe camada de dados partilhada (sem React Query/SWR/store). O unico mecanismo de "invalidacao" sao: `refreshKey` passado por props, `version` devolvido por hooks, e 4 mini barramentos de eventos no `window` (`lib/socialEvents.ts`, `hooks/useAreaRatings.ts:13`, `lib/onTimeQuestion.ts`, `lib/calendarSyncEvents.ts`). O React Compiler esta ativo na maior parte da app (`vite.config.ts:6-47`), por isso falta de `useMemo` manual raramente tem custo real.

#### 1. Padrao de bug do Wellbeing: dados duplicados e cartoes desatualizados

O Wellbeing em si ja foi corrigido por elevacao de estado (`pages/Wellbeing.tsx:33-35`, `useMedications().version` como chave). Sobram buracos nele e o mesmo padrao existe noutras paginas.

| ID | Area | Ficheiro:linha | O que esta mal | Impacto (acao num cartao deixa outro desatualizado) | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|---|
| F-01 | Wellbeing | `components/Wellbeing/MedicationsCard.tsx:151`, `hooks/useMedications.ts:97-108` | `useMedicationReminderStatus` usa `meds.medications` como chave. `toggleDose` so faz `setSlots` otimista e `bump()`, nunca muda `medications`. | Marcar "Tomei" num slot nao atualiza a linha de estado do lembrete (pendente/enviado) do mesmo cartao ate haver outra mutacao ou refresh. | Usar `meds.version` como chave do `useMedicationReminderStatus`. | S | B |
| F-02 | Wellbeing | `hooks/useMedications.ts:79-91`, `:57-62` | `run` (add, update, remove, logIntake, removeIntake, acceptDisclaimer) faz sempre `load()` completo: 4 GETs (`getMedications`, `getMedicationDay`, `getMedicationIntakes`, `getMedicationDisclaimer`), mais `bump()` que dispara outros 2 GETs (historico e insights) e o reminder status. O aviso legal nao muda com quase nenhuma destas acoes. | Cada gravacao = ~7 GETs. Latencia percebida e carga no backend. | Separar `load` por parte: refrescar so `medications`+`slots` (e `intakes` se for toma extra); carregar o disclaimer so no mount e em `acceptDisclaimer`. | M | M |
| F-03 | Wellbeing | `pages/Wellbeing.tsx:36`, `components/Wellbeing/BloodDonationsCard.tsx:35` | O cartao de doacoes tem o seu proprio `useLoadOnce(getBloodDonations)` sem ligacao a `insights`/`BurnoutAlertCard`. Se o backend usar doacoes nas correlacoes (nao verifiquei o backend), registar uma doacao nao refresca os insights. Marcado como a confirmar no backend. | Possivel insight desatualizado. | Se aplicavel, expor `version` do cartao de doacoes e juntar a chave de `useWellbeingInsights`. | S | B |
| F-04 | Focus | `components/Study/focus/SessionHistoryCard.tsx:42,56-68` vs `DayProgressCard.tsx:26-27`, `BestTimesHeatmap` (`hooks/useBestTimesHeatmap.ts:22`), `Focus.tsx:27` (`useDistractionStats`) | Cada cartao tem o seu `useSessionHistory`/heatmap/streak e so reage ao `activeSession.id`. `mutate` do historico (criar sessao manual, corrigir, apagar) faz `reload()` so da propria lista. | Apagar/editar/acrescentar uma sessao: o anel "Hoje" (minutos feitos) e a streak do `DayProgressCard`, o heatmap e as estatisticas de distracao ficam errados ate F5. Mesmo bug do Wellbeing. | Contexto/hook partilhado `useStudyData` com `version`, ou barramento `sessions-changed`; `SessionHistoryCard.mutate` chama-o e os 4 consumidores usam-no como `refreshKey`. | M | B |
| F-05 | Focus | `hooks/useBestTimesHeatmap.ts:15`, `hooks/useDistractionStats.ts:14`, `hooks/useSessionHistory.ts` (chave = `activeSession.id`) | O `refreshKey` e o id da sessao ativa, que muda no INICIO (null para id) e no FIM (id para null). No inicio nada mudou nas estatisticas, mas refaz-se heatmap, historico, streak, distracao (4 GETs). Alem disso heatmap e distracao fazem `setIsLoading(true)` em cada refetch, o que faz o cartao voltar ao esqueleto (piscar) em vez de manter os dados. | 4 GETs inuteis a cada "iniciar sessao" e flicker dos cartoes ao parar. | Chave = id da ultima sessao terminada (so muda ao parar) e refetch silencioso (sem `setIsLoading(true)` se ja ha dados). | S | B |
| F-06 | Dashboard | `components/Dashboard/DashboardCardGrid.tsx:63-130` (`FailingRiskCard`, `GradeProjectionCard`, `CourseForecastCard`, `PlanScenarioCard`, `EstimationAccuracyCard`, `TimeByAreaCard`, `RatingsSummaryCard`, `FocusEffectCard`, `StudyCapacityCard`, `EctsWorkloadCard`), `hooks/useGradeProjection.ts:5`, `useCourseForecast.ts:5`, `usePlanScenario.ts:5`, `useFocusEffect.ts:5` | ~12 cartoes com fetch proprio via `useLoadOnce` sem chave. A tabela do Dashboard so atualiza `tasks` local (`pages/Dashboard.tsx:94-95,210-211`). | Concluir uma task, lancar nota real ou mudar peso na tabela deixa projecao de nota, previsao de curso, risco de chumbar, cenario de plano e precisao de estimativas desatualizados ate F5. Os cartoes que recebem `tasks` por props atualizam; os que se autoalimentam nao. So o `MissingGradeCard` tem chave (F-07). | Um `TasksRevision` (contador no `useDashboardData`, subido em `setTasks` de mutacao) passado ao contexto dos cartoes, usado como `refreshKey` do `useLoadOnce`. Ou evento `tasks-changed`. | M | M |
| F-07 | Dashboard | `pages/Dashboard.tsx:324` | `refreshKey={tasks.reduce((sum, task) => sum + (task.weightPercentage ?? 0), tasks.length)}` e um hash improvisado: muda com peso ou contagem, mas calcula-se a cada render sobre todas as tasks e colide (trocar pesos que somam o mesmo nao refresca). | Refresh falhado em edicoes que preservam a soma. | Substituir pela revisao do F-06. | S | B |
| F-08 | Dashboard | `hooks/useTodayOverview.ts:28-45`, `components/Dashboard/TodayCard.tsx:53` | `useTodayOverview` corre uma vez no mount (deps `[]`). `dueToday` vem de `/tasks/today`, independente de `tasks` do Dashboard. | Concluir/adiar uma task na tabela nao a tira da lista "vencem hoje" do cartao Hoje. | Refrescar com a revisao do F-06, ou filtrar `dueToday` pelo estado local das tasks. | S | B |
| F-09 | Dashboard/global | `hooks/useDailyDigest.ts:16,26-37`, `components/Digest/DailyDigestHost.tsx`, `routes/AppRouter.tsx:259` | O digest diario (montado ao nivel do router) chama `useTodayOverview()` (4 GETs) e `getUserTasks()` (todas as paginas) em paralelo com o Dashboard, que pede as mesmas coisas (o `TodayCard` repete os 4 GETs, o `getUserTasks` do Dashboard pode ter `periodParam` diferente e nao deduplica). Nao partilham resultado. | Ao abrir a app no Dashboard: 2x `getTodayTasks/getSchedule/getWorkShiftRange/getStudyPlan` e 2x `getUserTasks` completo. | Montar o digest so quando vai realmente aparecer (o comentario ja o diz) e/ou partilhar `useTodayOverview` por um modulo-cache com TTL curto. | M | M |
| F-10 | Dashboard | `components/Dashboard/StudyActivityCard.tsx:74,92-96` e `components/Study/focus/DayProgressCard.tsx:27` | Dois pontos distintos buscam `getStudyStreak()` e cada um tem o seu `reloadStreak` ligado ao `StreakRestDayButton`. O botao tem ainda o seu `getStreakFreezeStatus` (`StreakRestDayButton.tsx:24`). Usar um dia de descanso atualiza a streak e o estado do botao, mas nao outro cartao de streak montado na mesma pagina. | Em cada pagina so um consome, logo sem bug visivel hoje; e risco de regressao se os dois ficarem na mesma pagina. | Hook unico `useStudyStreak` com fonte partilhada. | S | B |
| F-11 | Areas | `hooks/useAreaTeacher.ts:15`, `hooks/useAreaOverview.ts:42-44`, `components/Areas/AreaDetailView.tsx:74-76` | `useAreaOverview` (pagina) guarda tarefas, risco e docentes; `AreaTeacherField` (modal) tem o seu `getAreaTeachers()` completo e grava sem avisar. Idem `AreaInterestPicker`. | Mudar o docente no modal nao atualiza o crachá/ordenacao/filtro por docente da grelha (`lib/areaOverview.ts:77-79`). Apagar uma area ou mudar tasks noutro separador tambem deixa `tasks/risk` do overview velhos (`useAreasPage.ts` so faz `setAreas`). | Evento `area-teacher-changed` (como `RATINGS_CHANGED_EVENT`) ou `version` do overview; `save` chama `refresh`. Cada modal pede a lista inteira de docentes para ler 1 area: aproveitar `byAreaId`. | S | B |
| F-12 | Areas | `hooks/useAreaRatings.ts:13-30,91,109`, `hooks/useRatingStats.ts` | As avaliacoes usam um barramento proprio (`pm-area-ratings-changed`) que so os cartoes de rating escutam. `useRatingStats` (Dashboard `RatingsSummaryCard`, pagina `Ratings`) nao escuta. | Se os dois estiverem no mesmo ecra (ou o utilizador voltar com a pagina em cache), as medias ficam desatualizadas. Hoje so se corrige ao recarregar. | `useRatingStats` escutar o evento e refetch. Unificar os 4 barramentos num `lib/bus.ts`. | S | B |
| F-13 | Schedule | `pages/Schedule.tsx:104-137`, `components/Schedule/WeekGrid.tsx:96`, `hooks/useMonthAgenda.ts:20`, `hooks/useScheduleTasks.ts:15-29` | `scheduleVersion` refresca tudo (semana, turnos, mes, ScheduleChanges, StudyVsClass, e `key={scheduleVersion}` desmonta e remonta o `StudyPlanCard`, `:128`). `setCancelled` ja tem o resultado local mas dispara `onScheduleChanged` completo (alem de `onAttendanceChanged`). `useScheduleTasks` pede TODAS as tasks de todos os periodos ao montar a grelha (cada alternancia Semana/Mes remonta e repete). | Marcar uma aula como cancelada: ~8 GETs e o plano de estudo volta ao esqueleto. Alternar vista repete o `getUserTasks('all')` completo. | `StudyPlanCard` com `refreshKey` em vez de remount; atualizar localmente o cancelamento e so refetch dos dependentes reais; cache de `useScheduleTasks` ao nivel da pagina Schedule (levantar o hook para `Schedule.tsx`). | M | M |
| F-14 | Social | `pages/Social.tsx:35-37,50`, `hooks/useNotesAccess.ts:42`, `useSharedWithMe.ts:45`, `useMyShares.ts:28`, `useSocial.ts:56`, `lib/socialEvents.ts` | 4 hooks independentes na mesma pagina, cada um com `useLiveRefresh` (20 s, 15 s, 30 s, 20 s) mais `getSocialPending` da Navbar (60 s). O barramento `notifySocialChanged` so e escutado por `useSocialPending` e `QuizShareLists`. | Aceitar um pedido de notas (`useNotesAccess.run`) nao refresca `useSharedWithMe`/`useMyShares`/`useSocial`. Alem disso, em cada foco do separador disparam 5 pedidos de uma vez. | `useSocial`, `useSharedWithMe`, `useMyShares`, `useNotesAccess` escutarem `onSocialChanged`; um unico `useLiveRefresh` na pagina a chamar os 4 `load`. | M | B |
| F-15 | Turmas | `pages/TurmaPage.tsx:35,67-75`, `components/Turma/TurmaPacksTab.tsx:98`, `TurmaProgramsTab.tsx:38`, `TurmaDeadlinesTab.tsx:68-70` | Cada separador remonta e repete o seu GET ao mudar de separador (sem cache). `TurmaPacksTab`/`ProgramsTab` pedem listas pessoais (`listTaskPacks`, `getPrograms`) so para marcar "ja tens". O cabecalho `turma` so e atualizado em `TurmaMembersTab.onChanged`; mudar anuncios/ficheiros nao afeta `latestAnnouncementAt` da lista em `Turmas.tsx:26`. | Voltar a um separador mostra esqueleto outra vez; "novo anuncio" na lista de turmas nao reflete anuncio visto/criado ate nova visita (na lista e refetch a cada mount, por isso corrige-se ao navegar). | Manter separadores montados (display none) ou cache por `turmaId`; baixo valor, prioridade baixa. | M | B |
| F-16 | Tasks/Focus | `hooks/useStudySession.ts:38-60`, `components/Study/focus/SessionForm.tsx:40`, `hooks/useTaskPacks.ts:26-28`, `hooks/useTaskImport.ts:48-50`, `hooks/useTaskPackImport.ts:33` | `getUserTasks()` (todas as paginas de 200) e `getUserAreas()` chamados em 11 sitios distintos, `getTaskMetadata()` em 7. O metadata e um catalogo global quase estatico (`useDashboardData.ts:19-21` ate o diz). Na pagina Focus o `StudySessionWidget` (`useStudySession`) e o `SessionForm` pedem as mesmas tasks duas vezes. | Em cada navegacao Dashboard para Tasks para Focus repete-se o download das tasks e do catalogo. Nao ha nenhuma invalidacao quando se cria/edita uma task numa pagina e se abre outra (refaz sempre, por isso nao fica velho, apenas caro). | Modulo-cache de `getTaskMetadata` (por sessao) e `getUserAreas`, invalidado por mutacoes; `getUserTasks` por periodo com stale-while-revalidate. Idealmente adotar TanStack Query. | L | M |
| F-17 | Finance | `hooks/useFinance.ts:62-73` | `version` sobe a cada escrita e o efeito de `getFinanceOwedPayments` refaz-se sempre, mesmo que a escrita nao toque em dividas. | Um GET inutil por escrita (resto da pagina bem ligado: `FinanceAnalytics refreshKey={finance.version}`). | Refetch so depois de `addFinanceOwedPayment`/`undoFinanceOwedPayment`/mutacoes de dividas. | S | B |
| F-18 | Flashcards/Quizzes/Profile | `pages/Flashcards.tsx:39-41,119`, `hooks/useFlashcards.ts:24-33`, `components/Flashcards/FlashcardForecast.tsx:62` | A previsao tem a sua chave (`forecastKey`), logo bem ligada. `useNotebookAreas()` e `useAreaLookup` repetem `getUserAreas`. Profile: `useProfileStats` (`hooks/useProfileStats.ts:24`) pede `getUserTasks()` + metadata so para calcular badges, que o `BadgeUnlockWatcher` (`components/Accessibility/BadgeUnlockWatcher.tsx:30`) tambem recalcula pedindo tudo de novo a cada conclusao (+1,5 s). | Cada conclusao de task descarrega TODAS as tasks outra vez so para contar badges, apesar de a pagina que concluiu ja as ter. | Calcular conquistas a partir das tasks ja em memoria (callback no `completeOne`), ou endpoint de contagens. | M | M |

Paginas onde NAO encontrei o padrao: Finance (analitica e resumo ligados por `version`), Turmas (lista e convites com reload apos acoes), Flashcards (chave de previsao), Schedule parcial (`scheduleVersion`).

#### 2. Refetch inutil e polling

| ID | Area | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|---|
| F-19 | Hooks base | `hooks/useLoadOnce.ts:14-32` | O nome diz "once" mas refaz a cada `fetcher`/`refreshKey` e nunca partilha resultado entre instancias. Sem `AbortController` (usa so flag `cancelled`), logo o pedido nao e cancelado. Chamado em 36 sitios. `fetcher` tem de ser estavel: varios chamadores criam `useCallback` por componente (ex.: `components/Turma/TurmaDeadlinesTab.tsx:69`). | Risco de loop se alguem passar uma funcao inline; sem cancelamento no unmount. | Aceitar `signal`, e opcionalmente chave de cache (`useLoadOnce(key, fetcher)`). | M | B |
| F-20 | Wellbeing | `hooks/useWellbeingInsights.ts:5`, `pages/Wellbeing.tsx:37` | A chave inclui `JSON.stringify(mood.log)` a cada render. Cada marcar de toma de medicacao (`bump`) refaz o calculo de insights no backend. | GET pesado por cada toque numa toma. | Debounce (1-2 s) ou so refrescar insights quando o humor muda ou ao sair de ciclo de edicao. | S | B |
| F-21 | Polling | `components/AccountBlocked/AccountBlockedPage.tsx:106` | `setInterval(refreshSilently, 30000)` sem verificar visibilidade (o resto da app usa `useVisibleInterval`/`useLiveRefresh`). | Separador esquecido em segundo plano num ecra de conta bloqueada continua a fazer pedidos. Baixo (so em contas bloqueadas). | Trocar por `useVisibleInterval`. | S | B |
| F-22 | Polling | `hooks/useNotebookEntries.ts:249-275` | Polling de media a 15 s e verificacao de URLs assinados a 60 s, ambos com guarda de visibilidade (bom), mas o polling de ids corre sempre com a entrada aberta mesmo sem foco da janela (so olha `visibilityState`). | Aceitavel; registo como observacao. | Usar `useVisibleInterval`. | S | B |
| F-23 | Polling | `hooks/useLiveRefresh.ts:21-52` usado em 8 hooks | Cada hook regista o seu `focus`/`visibilitychange`/SW message. Numa pagina com N hooks, voltar ao separador dispara N pedidos simultaneos (ex.: Social: 4 mais a navbar). O `MIN_GAP_MS` e por instancia. | Rajada de pedidos ao refocar. | Coordenador global (um unico listener que chama todos os `refresh` registados, escalonados). | M | B |
| F-24 | Tasks | `hooks/useTasksPage.ts:520-535` | `replanTasks` faz um `bulkRescheduleTasks` por dia de destino em serie e depois `fetchTasks` completo (todas as paginas) no `finally`, mesmo em falha; o `AbortController` e criado e nunca guardado/cancelado. | Refetch completo onde bastava atualizar as tasks movidas; sem cancelamento. | Aplicar localmente as `moves` bem sucedidas; `fetchTasks` so em falha parcial. | S | B |
| F-25 | Dashboard/Tasks | `hooks/useDashboardData.ts:81`, `hooks/useTasksPage.ts:139` | Dependencia `[periodParam, isAcademicLoading]` correta, mas `fetchMeta`/`fetchTasks` fora de `useCallback` com `eslint-disable` (`useTasksPage.ts:104-107,140`). `setIsTasksLoading(true)` a cada mudanca de periodo mostra esqueleto em vez de manter a lista. | Flicker ao trocar periodo. | `useCallback` + mostrar dados antigos com indicador. | S | B |

#### 3. Duplicacao de hooks, servicos e componentes

| ID | Par ou grupo (ficheiro:linha) | Observacao | Correcao | Esf. | Risco |
|---|---|---|---|---|---|
| F-26 | `hooks/useDashboardData.ts:19-87` e `hooks/useTasksPage.ts:89-143` | Mesma logica de `fetchMeta` + `fetchTasks` por periodo com abort, copiada (a propria `useTasksPage` cita "Same split as Dashboard.tsx"). | Extrair `useTaskCatalog` (areas+metadata) e `usePeriodTasks(periodParam)`. | M | M |
| F-27 | `hooks/useCourseRiskOverview.ts:10-40` e `hooks/useRatingStats.ts:10-45` | Mesmo esqueleto: `needsPeriod`, `isWaitingForPeriod`, `attempt/retry`, abort e `isRequestCanceled`. | Hook generico `useActivePeriodResource(fetcher)`. | M | B |
| F-28 | `hooks/useSessionHistory.ts`, `hooks/useBestTimesHeatmap.ts`, `hooks/useDistractionStats.ts`, `hooks/useStudyVsClass.ts`, `hooks/useWeightBudget.ts`, `hooks/useWeightBudgets.ts` | Seis variantes do mesmo "fetch + refreshKey + cancelled + isLoading + error". `useWeightBudget` e `useWeightBudgets` (25 e 28 linhas) so diferem no endpoint. | Um `useFetch(fetcher, deps, {silent})`. | M | B |
| F-29 | `hooks/useSocial.ts:36-52`, `useSharedWithMe.ts:25-40`, `useMyShares.ts`, `useNotesAccess.ts:25-39` | Padrao `load(silent)` + `useLiveRefresh` + `run()` com `notify(social.actionError)`, copiado 4 vezes. | Hook `useLivePolled(fetcher, intervalMs)` com `run`. | M | B |
| F-30 | `hooks/useExamMode.ts`, `useSingleTaskMode.ts`, `useShowArchivedTasks.ts`, `useTableDensity.ts`, `useTasksView.ts`, `useScheduleView.ts`, `useNoLeisureGoalPref.ts`, `useAbsenceLimitPref.ts`, `useEctsHoursPref.ts`, `useDailyDigestPref.ts` (10 ficheiros de 27 a 41 linhas) | Cada um repete `loadPref` com try/catch de `localStorage` + `useEffect` de gravacao. 53 chamadas a `localStorage.getItem` em 57 ficheiros, sem helper (`usePersistedState`/`useLocalStorage` nao existe). Sem sincronizacao entre instancias exceto onde ha evento (`useStreakRestPref`, `usePaletteShortcutsPref`). | `usePersistedState(key, default)` com `useSyncExternalStore` e evento `storage`. | M | B |
| F-31 | `components/Dashboard/TaskCard.tsx`, `components/Tasks/TaskCard.tsx`, `components/Tasks/TaskBoardCard.tsx`, `components/Dashboard/TaskTableRow.tsx` | Quatro renderizacoes de uma task com logica de estado/prioridade/data semelhante (nao li o corpo todo; confirmar antes de extrair). | Extrair `useTaskPresentation`. | M | M |
| F-32 | `hooks/useTaskImport.ts:48-50` e `hooks/useTaskPackImport.ts:33` | Ambos carregam `getUserAreas` (+ metadata/programas) em paralelo para casar nomes. | Partilhar o catalogo (ver F-16). | S | B |
| F-33 | `hooks/useTurmas.ts:22-80` | 8 wrappers de uma linha de `useLoadOnce` com `useCallback` identico. Aceitavel, mas cada um repete o padrao de `fetcher` estavel. | Factory `makeTurmaHook`. | S | B |

#### 4. Componentes e hooks grandes (>400 linhas, so `.ts/.tsx` fora de i18n e stories)

| ID | Ficheiro | Linhas | Mistura | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-34 | `components/CommandPalette/CommandPalette.tsx` | 976 | Fetch (`getUserTasks:428`, `getUserAreas:444`, `getTaskMetadata:661`), indexacao, ranking, atalhos e UI no mesmo ficheiro. | Dividir em `usePaletteData`, `buildPaletteItems`, vista. | L | M |
| F-35 | `lib/quizGenerators.ts` (923), `lib/quizSession.ts` (544), `lib/quizImport.ts` (462) | Logica pura, sem UI. Tamanho alto mas coeso. | Dividir por tipo de pergunta so se crescer. | M | B |
| F-36 | `pages/Notebook.tsx` | 616 | Pagina com selecao de area, lista, editor, partilha, `useMyShares:147`. | Extrair `useNotebookPage` (como `useTasksPage`) e sub-paineis. | M | M |
| F-37 | `hooks/useTasksPage.ts` | 572 | Fetch, CRUD, sync Google Calendar (`:149`), replan (`:521`), import, subtasks num so hook. | Dividir em `useTaskCrud`, `useTaskCalendarSync`, `useTaskReplan`. | L | M |
| F-38 | `api/userService.ts` (571), `api/financeService.ts` (507), `api/notebookService.ts` (370) | Servicos monoliticos: utilizador, areas, tasks, programas, metadata no mesmo ficheiro (`getUserTasks` esta em `userService.ts:360`, nao em `tasksService`). | Separar por dominio (`tasksService`, `areasService`, `programsService`). | M | B |
| F-39 | `pages/SharedNotebookEntry.tsx` (551), `components/ApprovalRules/ApprovalRulesModal.tsx` (547), `pages/Areas.tsx` (487), `components/Quizzes/QuizHome.tsx` (452), `components/AccountBlocked/AccountBlockedPage.tsx` (446), `pages/Dashboard.tsx` (431), `pages/QuizDetail.tsx` (411), `components/Notebook/NotebookEntryShare.tsx` (404) | Paginas que juntam dados, logica e UI. `Dashboard.tsx` tem ~25 `useMemo/useState` e 12 hooks proprios. `pages/PrivacyPolicy.tsx` (426) e `lib/changelog.ts` (686) sao texto/dados, aceitaveis. | Extrair um hook por pagina (`useDashboardPage`) e sub-componentes. | L | M |

#### 5. Memoizacao com custo real

| ID | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-40 | `components/Schedule/WeekGrid.tsx:114-140` | `shiftsByDay`, `occurrencesByDay`, `days` calculados a cada render fora de `useMemo` (o ficheiro nao esta nas exclusoes do compilador, por isso e provavel que o React Compiler os memoize; nao medi). | Baixo se o compilador atuar. | Confirmar no build com o plugin; senao `useMemo`. | S | B |
| F-41 | `pages/Dashboard.tsx:324` | `tasks.reduce(...)` em cada render para a chave (ver F-07). | O(n) por render em listas de centenas de tasks. | Remover com F-07. | S | B |
| F-42 | `pages/Wellbeing.tsx:37` | `JSON.stringify(mood.log)` por render. | Desprezivel (objeto pequeno). | Ver F-20. | S | B |

Nota: o `vite.config.ts` exclui do compilador todos os `*Card`/`*Chart` do Dashboard exceto `TaskCard`, a pagina `Profile` e paginas frias. Nao encontrei calculos pesados em render fora do que o compilador cobre; por isso nao ha achado de memoizacao de alto custo.

#### 6. Bundle e lazy loading

Estado verificado: `routes/pages.ts` tem todas as ~55 paginas em `lazyWithPreload`; cartoes do Dashboard em `components/Dashboard/lazyCards.ts`; `CommandPalette` e `TaskImportModal` (que arrasta `xlsx`) lazy; `recharts` so em paginas/cartoes lazy. `dist/` existe (build de 2026-11-01, pode estar desatualizado): `index-*.js` 405 KB (126 KB gzip), `TaskImportModal` 370 KB, `CartesianChart` 339 KB, dicionarios 215 a 267 KB cada, `ResetPassword` 206 KB (supabase).

| ID | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-43 | `i18n/I18nProvider.tsx:46-47`, `i18n/dictionaries.ts:13-20` | Cada lingua e UM chunk monolitico (~215-267 KB raw; pt = 71 KB gzip) com ~2561 chaves de todas as paginas, e o provider devolve `null` ate chegar (`if (!ready) return null`). Bloqueia o primeiro render, incluindo login. | Primeiro paint espera 70 KB gzip extra em cada visita fria. | Partir o dicionario por namespace/rota (nucleo + por pagina, carregado com o chunk da pagina). | L | M |
| F-44 | `vite.config.ts:111-125` | Sem `manualChunks`. Vendor (react, react-router, axios, lucide) vai no `index-*.js` e invalida a cada deploy. `CartesianChart` (recharts) fica partilhado automaticamente, mas o resto nao. | Cache do browser perdida a cada release. | `manualChunks` para `react`, `router`, `axios`, `recharts`. | S | B |
| F-45 | `routes/AppRouter.tsx:5-7` | `Login`, `Register`, `ForgotPassword`, `AuthCallback`, `CookieNotice`, `DailyDigestHost`, `CalendarSyncReviewModal`, `PushPermissionPrompt` importados estaticamente no chunk de entrada (as restantes paginas sao lazy). `CalendarSyncReviewModal` e `DailyDigestHost` so aparecem em casos pontuais. | Parte dos 405 KB do entry. | `lazyWithPreload` para modais pontuais e Register/ForgotPassword. | S | B |
| F-46 | `pages/ResetPassword.tsx:3`, `lib/supabaseClient.ts:1` | O `@supabase/supabase-js` (cerca de 200 KB no chunk `ResetPassword`) so e usado numa pagina; ok por ser lazy. Observacao, sem acao. | Nenhum. | n/a | n/a | n/a |

#### 7. Cache de GETs e `client.ts`

| ID | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-47 | `api/client.ts:24`, `api/dedupeGets.ts:25-45` | O dedupe so cobre pedidos em voo. Duas chamadas separadas por milissegundos apos a primeira terminar repetem a rede; o `config.signal` da primeira e removido (`signal: undefined`), por isso se todos os chamadores cancelarem, o pedido continua ate ao fim. Chave `api.getUri(config)|responseType`: nao inclui o utilizador, mas o cache so existe em voo, logo seguro. | Nao ha TTL nem stale-while-revalidate: ver F-16. | Cache curto (2-5 s) para GETs de catalogo (`/tasks/metadata`, `/areas`) com invalidacao por mutacao do mesmo prefixo. | M | M |
| F-48 | `api/fetchAllPages.ts:26-72`, `api/userService.ts:360` | `getUserTasks` busca TODAS as paginas de 200 em serie (cada pagina espera a anterior por causa do cursor) ate 20000 itens, em 11 sitios. | Utilizador com 1000+ tasks: 5+ round trips em serie a cada carga de pagina. | Cursor so e necessario em serie; pedir a primeira pagina e mostrar, ou endpoint de contagens/agregados para os cartoes que so contam (digest, badges, profile). | L | M |

#### 8. Listas sem paginacao ou virtualizacao

| ID | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-49 | `components/Dashboard/TasksTable.tsx`, `components/Dashboard/TaskTableRow.tsx:161`, `components/Tasks/TaskGrid.tsx`, `TaskBoard.tsx`, `TaskTimeline.tsx` | Nao ha virtualizacao em lado nenhum (`grep` por `react-window`/`virtual` so devolve IntersectionObserver para `OnThisPage` e `StickyMobileCta`). Todas as tasks do periodo (ou "todos os periodos") renderizam de uma vez. So `SessionHistoryCard` e `PlanTaskList` usam `useIncrementalReveal`. | Com algumas centenas de tasks, mais colunas e cartoes, o primeiro render e o filtro ficam lentos; mais critico em "Ver todos os periodos". | `useIncrementalReveal` na tabela/quadro (50 por vez) ou virtualizacao da tabela. | M | M |
| F-50 | `hooks/useNotebookEntries.ts`, `pages/Notebook.tsx` | A lista de resumos usa `fetchAllPages` completo (`api/notebookService.ts:62`), sem revelacao incremental na UI. | Cadeiras com muitas aulas carregam todos os resumos. | Revelacao incremental. | S | B |
| F-51 | `components/CommandPalette/CommandPalette.tsx:428-444` | Carrega todas as tasks e areas ao abrir para filtrar no cliente. | Cada abertura (com cache de lista parcial) repete o download completo (corrigido em F-07 do relatorio so para falhas). | Pesquisa no servidor ou usar o cache do F-16. | M | M |

#### 9. Constantes e strings repetidas

| ID | Ficheiro:linha | Observacao | Correcao | Esf. | Risco |
|---|---|---|---|---|---|
| F-52 | Chaves de `localStorage` (`pm-exam-mode` em `hooks/useExamMode.ts:3`, `pm-single-task-mode` em `useSingleTaskMode.ts:3`, `pm-show-archived-tasks` em `useShowArchivedTasks.ts:3`, etc., 53 usos em 57 ficheiros) | Cada hook define a sua chave local; sem registo central, risco de colisao e dificuldade de limpar no logout. | `lib/storageKeys.ts` e limpeza no logout. | S | B |
| F-53 | Intervalos de polling (`useSocialPending.ts:7` 60000, `useSocial.ts:56` 20000, `useNotesAccess.ts:42` 20000, `useMyShares.ts:28` 30000, `useFriendHub.ts:39` 30000, `SharedNotebookEntry.tsx:105` 8000, `AccountBlockedPage.tsx:35` 30000) | Numeros magicos espalhados. | `lib/pollIntervals.ts`. | S | B |
| F-54 | Mensagem de erro `translateNow('social.actionError')` (`useSocial.ts`, `useSharedWithMe.ts`, `useNotesAccess.ts`) e chaves de erro por hook (`hook.couldNotLoad...`) | Repetidas em 4 hooks com a mesma estrutura (ver F-29). | Resolver junto com F-29. | S | B |

#### 10. Prop drilling com mais de 2 niveis

| ID | Ficheiro:linha | Observacao | Correcao | Esf. | Risco |
|---|---|---|---|---|---|
| F-55 | `pages/Areas.tsx:180-193` para `AreaGrid` (`components/Areas/AreaGrid.tsx:22-24,94-96`) para `AreaCard` (`AreaCard.tsx:26-27,148`) para `AreaOverviewBadges` | `overviewById`, `overviewLoading`, `overviewFailed` descem 3 niveis, via objeto `gridProps` com 13 chaves. | Contexto `AreaOverviewContext` ou passar so `overview` por area. | S | B |
| F-56 | `pages/Dashboard.tsx` para `DashboardCardGrid.tsx:15-40,63-130` para ~25 cartoes | `academicTasks`, `academicAreas`, `academicTaskTypes`, `activeProgram` passam pelo grid a cada cartao (2 niveis, mas 7 props repetidas em 25 sitios). | Contexto `DashboardDataContext` (o mesmo que alimenta F-06). | M | B |
| F-57 | `pages/Wellbeing.tsx:46-47` | Passa o objeto `meds` inteiro (30 membros) ao `MedicationsCard`. Aceitavel (1 nivel). | n/a | n/a | n/a |

#### 11. Chamadas HTTP fora de `api/*Service.ts`

| ID | Ficheiro:linha | O que esta mal | Impacto | Correcao | Esf. | Risco |
|---|---|---|---|---|---|---|
| F-58 | `components/Tasks/TaskHistorySection.tsx:2,19-21` | Importa `api` de `../../api/client` e faz `api.get('/tasks/:id/changes')` dentro do componente; tipo `TaskChange` vem de `lib/taskHistory`. | Quebra a regra de servicos (sem tratamento central, dificil de testar/mocar). | Criar `getTaskChanges(taskId)` em `api/userService.ts` (ou `tasksService`). | S | B |
| F-59 | `pages/AdminUserProfile.tsx:3,56` | Usa `axios.isAxiosError` na pagina (so para ler o status), nao faz GET; mesmo padrao em `hooks/useAgentConfig.ts:2`, `useFinance.ts:2`, `useFinanceImport.ts:2`, `useSocial.ts:2`, `pages/FriendLink.tsx:3`. | Acoplamento da UI ao axios; ja existe `lib/httpError.ts`/`getHttpStatus`. | Trocar por `getHttpStatus` (ja usado em `StudySessionProvider.tsx:222`). | S | B |
| F-60 | `components/Agent/DownloadSetupButton.tsx:60` | `fetch(VANILLA_EXE_URL)` direto, de proposito (comentario `:54`) para colar a API key ao binario. | Intencional; sem acao. | n/a | n/a | n/a |
| F-61 | `hooks/useHealthCheck.ts:34`, `hooks/useStatusPage.ts:36` | Usam `rawFetch` exportado de `api/client` (de proposito: sem cookies nem redirect 401). | Aceitavel; vive no client. | n/a | n/a | n/a |

#### Prioridade sugerida

1. F-04, F-06, F-01 e F-11/F-12/F-14 (bugs de estado desatualizado, esforco baixo a medio, mesma receita do Wellbeing: chave/versao partilhada ou evento).
2. F-16 mais F-47/F-48 (cache de catalogo e de tasks): maior ganho de rede, risco medio; considerar TanStack Query, que resolveria 1, 2 e 3 de uma vez.
3. F-43 (dicionario bloqueia primeiro render) e F-44 (`manualChunks`).
4. F-49 (listas sem virtualizacao) se houver utilizadores com muitas tasks.
5. Duplicacao (F-26 a F-30) e tamanhos (F-34, F-37, F-39) como refatoracao gradual.

Limites desta auditoria: nao corri a app nem medi renders; F-03, F-31 e F-40 ficam marcados "a confirmar". O estado de `dist/` pode nao refletir o codigo atual.

### 5.2 Verificações transversais (T-01 a T-05)

Resumo: i18n limpo; sem verdes, emojis ou em dashes no codigo; sem confirm/alert nativos; o `Modal` partilhado fecha sempre no backdrop; varios setInterval fora de `useVisibleInterval`; muitos `truncate` sem title; hex cruas concentradas em graficos e canvas.

| # | Ficheiro:linha | O que | Contagem |
|---|---|---|---|
| 1 | frontend/src/components/Areas/AreaForm.tsx:97 | placeholder "E.g: 6" em en fixo | 1 |
| 1 | frontend/src/components/Schedule/CommuteSettingsCard.tsx:207 | placeholder "e.g. 25" em en fixo | 1 |
| 1 | frontend/src/components/Profile/DeleteAccountModal.tsx:36 | placeholder "DELETE" (provavelmente literal de confirmacao, rever) | 1 |
| 1 | frontend/src/pages/DmcaPolicy.tsx, Eula.tsx, PrivacyPolicy.tsx | title="..." de LegalSection/LegalPageLayout em en fixo (paginas legais, so en; provavelmente intencional) | ~30 |
| 1 | pages/Login.tsx:174, ForgotPassword.tsx:56; FinanceHoldings.tsx:193; UsefulLinksSection.tsx:88 | placeholders de exemplo (email, ticker, url), nao traduziveis | 4 |
| 1 | toast com literal | grep de toast.*('Texto') sem resultados | 0 |
| 2 | `node frontend/scripts/check-i18n.mjs` | 4689 chaves, 8 linguas, 0 problemas | 0 em falta |
| 3 | frontend/src/components/Dashboard/GpaTrendChart.tsx:103,107,117 (+ ~15) | hex cruas em SVG | 18 |
| 3 | frontend/src/components/Quizzes/QuizEvolutionChart.tsx | hex cruas | 7 |
| 3 | frontend/src/components/Notebook/canvas/canvasConstants.ts; canvasShapeDefs.ts; NotebookShapeNode.tsx; CanvasLinksLayer.tsx; NotebookTextNode.tsx; NotebookSubjectPicker.tsx; hooks/useDrawingCanvas.ts; hooks/useCanvasTexts.ts | hex cruas canvas | 9+7+3+2+1+1+1+1 |
| 3 | pages/TaskTypes.tsx; PriorityBadge.tsx; TaskTypeForm.tsx; PriorityForm.tsx; PrioritiesTable.tsx; TaskTypesTable.tsx; ColorSwatches.tsx; FriendNotes.tsx; sharedWithMeLabels.ts; AccessibilitySettingsCard.tsx; hooks/useAccessibilityPrefs.ts(6); lib/accentColor.ts(8); utils/exportSvgAsPng.ts | hex cruas (varias sao cores escolhidas pelo utilizador, rever) | ~28 |
| 3 | styles/accents.css (189), index.css (38) | hex em css (accents e base, provavelmente ficheiros de tema) | 227 |
| 3 | classes tailwind green/emerald/lime/teal em tsx/ts | nenhuma; so tokens `--color-emerald-*` em frontend/src/styles/themes.css:165+ (remap do tema) | 0 classes |
| 4 | frontend/src e backend/src, ts/tsx/css | em dashes: so em frontend/src/i18n/messages/financeUndo.test.ts:13 e frontend/src/lib/wordCount.test.ts:12 (testes, intencionais) | 2 |
| 4 | emojis | grep PCRE falhou no motor; usar outra verificacao antes de afirmar | nao confirmado |
| 5 | frontend/src/components/UI/Modal.tsx:104 | overlay onClick={onClose}, sem prop para desativar; afeta todos os 33 ficheiros que usam `<Modal` (incl. formularios: EditProfileModal, CreateProgramModal, RenameProgramModal, QuizUploadModal, ImportCardsModal, CardEditor, ShiftChangeModal, IntakeLogModal, ApprovalRulesModal) | 1 origem, 33 consumidores |
| 5 | frontend/src/components/UI/ImageLightbox.tsx:71 | fecha no backdrop (lightbox, aceitavel) | 1 |
| 5 | frontend/src/components/UI/ModalHeaderActions.tsx | so acoes de cabecalho, sem backdrop | 0 |
| 6 | barras mobile | nao encontrei ficheiros Mobile/Bottom em components/Layout; nada claro | 0 confirmados |
| 7 | `truncate` sem title na mesma linha | 128 ocorrencias em tsx; top: Wellbeing/MedicationsCard.tsx (5), Notebook/NotebookEntryShare.tsx (5), CommandPalette.tsx (3), FriendProfile.tsx (2), AdminUserProfile.tsx (2), AdminPersonList.tsx (2), Breadcrumbs.tsx (2), TurmaSubjectsTab.tsx (2), TaskCard.tsx (2), PlanTaskList.tsx (2), PersonRow.tsx (2), InvitationCard.tsx (2), NotebookSearchResults.tsx (2), NotebookEntryList.tsx (2), PeriodSelector.tsx (2). Pode haver falsos positivos se title estiver noutra linha | 128 |
| 8 | window.confirm/alert/prompt nativos | nenhum no codigo (so comentarios em context/feedback-context.ts:21,23 e FeedbackProvider.tsx:28, e strings em testes) | 0 |
| 9 | frontend/src/components/Agent/DownloadSetupButton.tsx:60 | `fetch(VANILLA_EXE_URL)` fora de api, justificado em comentario (l.54) | 1 |
| 9 | lib/abortable.ts:9; pages/AdminUserProfile.tsx:56 | so `axios.isCancel/isAxiosError`, nao sao pedidos | 0 |
| 10 | components/AccountBlocked/AccountBlockedPage.tsx:106 | setInterval poll de estado | 1 |
| 10 | components/Study/focus/BreakBanner.tsx:20 | setInterval 1s | 1 |
| 10 | context/StudySessionProvider.tsx:194,226 | tick e heartbeat | 2 |
| 10 | hooks/useHealthCheck.ts:57; useIdleSession.ts:25; useLisbonToday.ts:26; useLiveRefresh.ts:36; useNotebookEntries.ts:251,275; useStatusPage.ts:53; lib/tabPresence.ts:59 | setInterval diretos (rever os que fazem polling de rede) | 9 |
| 10 | hooks/useVisibleInterval.ts:33 | a propria implementacao | 1 |

## 6. Fricções do utilizador (secção própria)

### 6.1 Tarefas, Áreas, Períodos, Notas, Flashcards, Quizzes (U-A01 a U-A36)

| ID | Entidade / página | Ficheiro:linha | Fricção | Impacto | Correção proposta | Esf. | Risco |
|---|---|---|---|---|---|---|---|
| U-A01 | Todos os modais (Tarefa, Pack, Flashcard, Importar cartões, Importar quiz) | `components/UI/Modal.tsx:51-53,101-104`; usos `Tasks.tsx:241`, `ImportCardsModal.tsx:49`, `CardEditor.tsx:45`, `QuizUploadModal.tsx:66`, `CreateTaskPackModal.tsx:68` | Clicar fora ou Escape fecha sempre, sem aviso de alterações por gravar. Nos formulários grandes (nova tarefa com checklist e notas; colar centenas de cartões ou um JSON de quiz) perde-se tudo | Perda de texto num clique acidental, sobretudo no telemóvel | Prop `isDirty`/`confirmClose` no Modal: pedir confirmação quando o formulário foi alterado; ou ignorar o clique no fundo nesses casos | M | Baixo |
| U-A02 | Quizzes | `api/quizzesService.ts:74` (`renameQuiz`, sem uso), BE `quizzes.controller.ts:66` | Endpoint PATCH e função existem, nenhuma UI renomeia. Título vem de um JSON de IA e não se corrige | Títulos maus ou duplicados ficam para sempre; só apagar e reimportar | Edição inline do título em `QuizDetail.tsx` (PageHeader) com `renameQuiz` | S | Baixo |
| U-A03 | Subtarefas | `api/subtasksService.ts:20` (aceita `title`), `SubtaskChecklist.tsx:151-157` | O PATCH de título existe mas o título é só texto: corrigir uma gralha obriga a apagar e recriar | Atrito frequente na checklist | Duplo clique/lápis no título a editar, Enter grava, Esc cancela | S | Baixo |
| U-A04 | Subtarefas (mobile) | `SubtaskChecklist.tsx:134-140,162,171` | Apagar e "to task" só aparecem em hover (`opacity-0 group-hover`), ícone de lixo 14px; reordenar só com drag HTML5, que não funciona em toque. Checkbox 16px | No telemóvel não se apaga nem reordena de forma fiável | Botões sempre visíveis em `pointer-coarse`, alvo >=40px, botões subir/descer em vez de drag | M | Baixo |
| U-A05 | Tarefas | `hooks/useTasksPage.ts:299-338`; `BulkActionsBar.tsx:98-124` | Apagar (individual e em massa) só tem confirmação, sem Desfazer; concluir tem Desfazer (`useCompleteWithUndo.ts:40`). Concluir pelo modal/atalho `c` também não oferece Desfazer (`useTasksPage.ts:404-417`), ao contrário do swipe | Inconsistência: a ação mais destrutiva é a que não se desfaz | Toast com "Desfazer" que recria a tarefa (guardar payload) ou apagar diferido ~6 s; usar `completeOne` no modal | M | Médio (recriar perde id, anexos, histórico) |
| U-A06 | Tarefas | `useTasksPage.ts:168-195,280-297,341-391` | Criar, editar e duplicar fecham o modal sem toast de sucesso. Nada confirma que gravou, e a tarefa pode ficar fora do ecrã (ordem manual) | Dúvida "gravou?" | `notify(..., 'success')` com título da tarefa | S | Baixo |
| U-A07 | Tarefas | `useTasksPage.ts:149-162` | Falha do Google Calendar após criar/editar é engolida sem aviso (comentário "falha silenciosa de propósito"); a checkbox "sincronizar" fica marcada como se tivesse corrido | Utilizador crê que o evento existe | Toast de aviso "Tarefa gravada, Calendar falhou" | S | Baixo |
| U-A08 | Tarefas (/tasks) | `pages/Tasks.tsx:152-193` vs `Dashboard/DashboardFilters.tsx:76-81`, `TaskExportButtons.tsx:20`, `BulkActionsBar.tsx` | A página Tarefas não tem pesquisa, filtros, seleção múltipla nem exportação; só o Dashboard as tem. Mesma entidade, duas páginas com capacidades diferentes | Quem usa /tasks (menu principal) não encontra uma tarefa por texto | Pesquisa e filtro de Área/estado na barra de /tasks (reutilizar `useTableSort`/filtros); link "ver no Dashboard" no mínimo | M | Baixo |
| U-A09 | Tarefas | `hooks/useTasksPage.ts:268-272,354`; `pages/Tasks.tsx:45`; `pages/Areas.tsx:68` | Texto hardcoded em inglês: "1 new task was created...", "N new tasks were created...", sufixo "(Copy)" ao duplicar, `useDocumentTitle('Tasks')`/`('Areas')` | Em pt/es/ja etc. aparece inglês misturado | Chaves `t()` nas 8 línguas; título do separador via `t('nav.tasks')` | S | Baixo |
| U-A10 | Tarefas, Período, Previsão | `GradeNeededCalculator.tsx:140,142`; `GradeImprovementCard.tsx:41`; `components/Tasks/TaskDetailView.tsx:124` | `toFixed(2)` dá ponto decimal em pt/fr/es/de; `toLocaleDateString()` sem idioma da app na data de fim de recorrência | Números e datas no formato errado para a língua escolhida | `formatNumber(value, lang, 2)` (já existe em `AreaCard`) e `toLocaleDateString(lang)` | S | Baixo |
| U-A11 | Importar tarefas | `components/Dashboard/TaskImportModal.tsx:34-39` | Escolher o ficheiro importa logo; não há pré-visualização, contagem prévia nem confirmação, nem ficheiro modelo para download. Erros só no fim | Importação errada cria dezenas de tarefas que só se apagam à mão (sem Desfazer) | Passo de pré-visualização (N linhas válidas, M erros) com botão "Importar"; link para CSV modelo | M | Médio |
| U-A12 | Modelos de tarefa | `hooks/useTaskTemplates.ts:9,43-46`; `TaskTemplatePicker.tsx:78-83` | Só em localStorage (não sincroniza entre dispositivos, perde-se ao limpar dados); guardar com nome igual substitui em silêncio; apagar sem confirmação nem Desfazer; sem renomear/editar; só existe no formulário de criar | Perda silenciosa de modelo | Confirmar substituição, Desfazer no toast do apagar; avaliar guardar no servidor | S (UI) / L (servidor) | Baixo / Médio |
| U-A13 | Anexos de tarefa | `components/Tasks/TaskAttachmentsSection.tsx:34-41,98`; BE `task-attachments.controller.ts:41-81` | Sem renomear (BE sem PATCH); upload sem toast de sucesso nem progresso (`useFileUpload` só mostra erro); apagar sem Desfazer | Pequeno atrito de feedback | Toast "Ficheiro adicionado"; estado "A enviar..." no label; renomear é opcional (exige endpoint) | S | Baixo |
| U-A14 | Packs | `components/TaskPacks/TaskPackList.tsx:79,36` | `void onDelete(pack.id)` ignora o `false` devolvido (`useTaskPacks.ts:57-65`): se falhar, nada acontece e a confirmação fica aberta; "copiar link" falha em silêncio sem permissão de clipboard | Falha invisível | Verificar resultado e mostrar toast de erro; no catch do clipboard selecionar o texto do link | S | Baixo |
| U-A15 | Packs | BE `task-packs.controller.ts:26-119` (sem PATCH); `TaskPackList.tsx:47` | Não há editar nome nem conteúdo de um pack; só apagar e criar de novo (o que muda o código partilhado) | Quem partilha o link perde-o ao corrigir uma gralha | Endpoint PATCH (nome/itens) + modal de edição; "Publicar atualizações" já existe `:68` | M | Médio |
| U-A16 | Packs (criar) | `components/TaskPacks/CreateTaskPackModal.tsx:94-114`; `hooks/useTaskPacks.ts:26` | Lista até todas as tarefas para escolher (máx 50) sem pesquisa nem filtro por Área; nenhum toast ao criar (`:59-61`) e erro genérico `:63`; lista de packs sem pesquisa/ordenação | Escolher 20 tarefas numa lista longa é lento | Campo de pesquisa e filtro de Área acima da lista; toast de sucesso | S | Baixo |
| U-A17 | Tipos de tarefa (admin) | `components/TaskTypes/TaskTypesTable.tsx:63-73`; `hooks/useTaskTypesPage.ts:57-96` | Ícone de lixo desativa o tipo sem confirmação (o tipo some dos formulários de todos os utilizadores); nome do ícone sugere apagar mas só desativa; criar/editar sem toast de sucesso | Desativação acidental com impacto global | Confirmação com contagem de tarefas afetadas, ícone "ocultar"; toast ao gravar | S | Baixo |
| U-A18 | Áreas | `components/Areas/AreaForm.tsx:47` | Nome só com espaços: o submit retorna sem mensagem (o `required` do HTML não apanha espaços) | Botão "não faz nada" | Mostrar erro `FormError` ou `setCustomValidity` | S | Baixo |
| U-A19 | Áreas | `hooks/useAreasPage.ts:122-123,135,203-209,221-228,177-186` | Criar/editar, retirar proposta, rejeitar (admin) e "desligar todas" as oficiais não dão toast de sucesso; "desligar todas" altera dezenas de Áreas sem confirmação nem Desfazer | Sem confirmação de que gravou; ação em massa fácil de disparar | Toasts de sucesso; Desfazer (toast) no "desligar todas" | S | Baixo |
| U-A20 | Áreas | `Areas/AreaForm.tsx:97`; `AreaCard.tsx:128` | `placeholder="E.g: 6"` e aria-label do interruptor `` `${nome} off/on` `` hardcoded em inglês | Leitores de ecrã e língua não inglesa | `t()` | S | Baixo |
| U-A21 | Períodos | `Layout/ManagePeriodsModal.tsx:202-213,82,93-95,250-274` | Na edição, os dois `<input type="date">` não têm rótulo (início/fim indistinguíveis, só vazio vs preenchido); sem validação fim >= início; erro de gravar ignora a mensagem da API (`periods.saveError`) ao contrário do arquivar `:132`; botões "Renomear/Fixar/Arquivar" `text-xs` sublinhados (~16px de alto) | Datas trocadas por engano; alvo de toque pequeno | Rótulos visíveis, validação local, `getApiMessage`, alvos >=40px | S | Baixo |
| U-A22 | Períodos / Boletim / Revisão | `Layout/PageLayout.tsx:20`; `pages/ReportCard.tsx:86-104`; `PeriodReview.tsx:96-117` | Os seletores de Programa/Período só aparecem em 5 rotas (`/dashboard /tasks /notebook /ratings /risk`). Boletim e Revisão têm um seletor próprio (estado `chosenId` separado do global, sem etiqueta "arquivado", sem ordem por data) | Em /areas, /flashcards, /report-card não se muda de período sem sair da página | Reutilizar o seletor global ou pelo menos ordenar e marcar arquivados nas opções | S | Baixo |
| U-A23 | Boletim | `ReportCard.tsx:48,62,108` | Só se exporta com `window.print()` (sem CSV/PDF direto); média e notas sem formatação de locale; sem coluna de ordenação | Partilhar o boletim com a faculdade passa por imprimir | Botão "Descarregar CSV" (padrão `downloadTextFile`) e `formatNumber` | S | Baixo |
| U-A24 | Componentes de nota | `Areas/GradeEntryChip.tsx:49,58-66`; `GradeComponentCard.tsx:109`; BE `grade-entry.dto.ts` | O BE aceita editar rótulo e data da nota, a UI só edita o valor. O rótulo ("Seminário 3") só aparece como tooltip `title` (invisível em toque). Remover nota é um "x" de ~22px sem confirmação nem Desfazer, ao lado do valor editável | Toque errado apaga uma nota e muda a média | Mostrar rótulo na chip, editar rótulo/data, Desfazer no toast, alvo maior | S | Baixo |
| U-A25 | Previsão | `Dashboard/GradeProjectionCard.tsx:93`; `GradeNeededCalculator.tsx:35` | O cartão devolve `null` em loading e em erro (desaparece sem estado de erro nem retry); o alvo de média da calculadora não se guarda e repõe a cada visita | Cartão "some" sem explicação em falha de rede | Estado de erro com "Tentar de novo"; guardar o alvo por Área em localStorage | S | Baixo |
| U-A26 | Notas pessoais | `pages/PersonalNotes.tsx:57-61`; BE `personal-notes.service.ts:53` (`take: MAX_PERSONAL_NOTES_PER_USER`) | Lista sem pesquisa, filtro ("com lembrete", "feitas") nem exportação; sem aviso quando o limite por utilizador é atingido além do erro ao criar | Com muitas notas não se encontra nada | Campo de pesquisa e filtros por estado; contador "N de MAX" | S | Baixo |
| U-A27 | Notas pessoais | `usePersonalNotes.ts:52-77`; `PersonalNoteForm.tsx:41`; `PersonalNoteItem.tsx:88-98` | Gravar/editar sem toast; lembrete no passado aceite sem aviso; ações "Editar/Fixar/Limpar lembrete" em `text-xs` sem alvo de toque; apagar sem Desfazer | Pequenos erros de feedback; toque difícil no telemóvel | Validar data futura, `min-h-10` nos botões, Desfazer | S | Baixo |
| U-A28 | Pad | `Pad/PadEditor.tsx:52,93,97`; `Pad.tsx:39-41`; BE `pads.controller.ts:166` | Não se copia nem descarrega o texto (só o link); `maxLength` corta colagens grandes sem aviso (o browser descarta o excesso); `min-h-[65vh]` usa `vh` (no telemóvel o teclado tapa o fim, o resto da app usa `dvh`); sem lista de pads recentes; apagar só ADMIN | Colar texto longo perde o fim sem se notar | Botões "Copiar texto"/"Descarregar .txt", aviso quando a colagem excede o limite, `dvh`, lista dos últimos pads abertos (localStorage) | S | Baixo |
| U-A29 | Caderno | `pages/Notebook.tsx:273-275,318`; `NotebookEntryList.tsx:29,48,143-148` | Erro na pesquisa global mostra "sem resultados" (engole o erro); abrir `?entry=` de uma nota apagada não diz nada; o filtro local só aparece com >=6 entradas e só procura no título (a pesquisa global procura no conteúdo); títulos `truncate` sem `title` | Resultado enganador; inconsistência entre duas pesquisas | Estado de erro na pesquisa; toast "nota não encontrada"; mostrar o filtro sempre e procurar também no preview; `title={...}` | S | Baixo |
| U-A30 | Caderno | `Notebook/entry/EntryToolbar.tsx:189,205`; BE `upsert-notebook-entry.dto.ts:369` | Apagar só existe em modo edição e Exportar só em modo leitura (inversos); não se move uma entrada para outra cadeira (decisão documentada no DTO, mas a UI não avisa nem oferece copiar); apagar sem Desfazer apesar de apagar fotos/anexos; sem importar | Quem criou a aula na cadeira errada tem de copiar à mão | Mostrar Exportar e Apagar nos dois modos; "Mover para..." (copia texto, apaga origem) | M | Médio |
| U-A31 | Flashcards | `pages/Flashcards.tsx:120-139`; `components/Flashcards/CardEditor.tsx:41`; `hooks/useFlashcards.ts:52-86` | Sem pesquisa de texto, ordenação nem seleção múltipla (apagar/mudar de Área em massa), nem exportar; "Guardar" fecha o modal, sem "guardar e criar outro" (criar 20 cartões = 20 aberturas); CRUD sem toast; apagar sem Desfazer | Gestão de baralhos grandes é lenta | Pesquisa por frente/verso, botão "Guardar e novo", toasts, exportar TSV (inverso do import) | M | Baixo |
| U-A32 | Flashcards (importar/rever) | `Flashcards/ImportCardsModal.tsx:95-99`; `ReviewSession.tsx:35-43` | O resumo só mostra 5 linhas ignoradas, sem "+N"; na revisão não há "desfazer última classificação" (um 3 por engano agenda o cartão para longe) | Erro de tecla fica gravado no SRS | "+N mais" como no quiz `QuizUploadModal.tsx:99`; tecla Backspace/Z para repor | M | Médio (backend sem endpoint para repor) |
| U-A33 | Quizzes (lista) | `pages/Quizzes.tsx:88-104` | Lista sem pesquisa, ordenação ou filtro (cresce até `MAX_QUIZZES_PER_USER`); sem etiqueta de data nem último uso | Encontrar um quiz depende de memorizar | Pesquisa por título e ordenar por recente/nota | S | Baixo |
| U-A34 | Quizzes (sessão) | `Quizzes/QuizHome.tsx:179`; `QuizDetail.tsx:375-378` | "Descartar" tentativa em curso não pede confirmação e perde as respostas guardadas; "Terminar agora" e "Descartar" lado a lado com o mesmo peso visual | Perda de progresso num clique | `useConfirmAction` antes de descartar | S | Baixo |
| U-A35 | Quizzes (partilha) | `Quizzes/QuizShareModal.tsx:63-66,173`; `QuizHome.tsx:404` | Ações de partilha (criar link, enviar a amigo, remover destinatário) sem toast e remover destinatário sem confirmação; histórico só se limpa todo (sem apagar uma tentativa); erro único "share.error" para todas | Pouca confirmação do estado | Toasts por ação, confirmação ao remover, mensagem do BE | S | Baixo |
| U-A36 | Programas | `Layout/ProgramSelector.tsx:108,120-126`; BE `update-program.dto.ts:14` | O BE tem `isActive`, o seletor esconde programas inativos e nenhuma UI os ativa/desativa; ícone de lápis rotulado "rename" abre "definições do programa" (nome + arredondamento); programa só se apaga (409 se tiver tarefas), sem arquivar | Quem acabou o curso não o consegue arquivar, só apagar com tarefas movidas | Alternar "arquivar programa" na modal de definições e rotular o ícone como "definições" | M | Médio |

### 6.2 Finanças, Bem-estar, Horário, Agente, Social, Perfil, Admin, Focus (U-B01 a U-B46)

| ID | Entidade / página | Ficheiro:linha | Fricção | Impacto | Correção proposta | Esf. | Risco |
|---|---|---|---|---|---|---|---|
| U-B01 | Global, modais com formulário | components/UI/Modal.tsx:104 e :52 | Clicar no fundo ou Escape fecha o modal sem verificar texto por gravar. Nenhum modal tem guarda de alterações (não há `isDirty` fora de Collab). Atinge editar movimento, UserEditForm, tipos, importar | Perde-se texto escrito, sobretudo ao tocar fora no telemóvel | Prop `dirty` no Modal: se verdadeira, confirmar antes de fechar por fundo/Escape | M | Médio |
| U-B02 | Global, Modal com ConfirmDialog por cima | components/UI/Modal.tsx:51-54; components/UI/ConfirmDialog.tsx:37 | Ambos escutam Escape em `window`: um Escape fecha o diálogo e o modal por baixo | Perde-se o formulário ao cancelar uma confirmação | Pilha de modais: só o do topo trata Escape | S | Baixo |
| U-B03 | Global, alvos de toque | components/UI/IconButton.tsx:33 (min-h-10 = 40px); components/UI/Button.tsx:20 (size sm py-1.5 ~32px) | Alvo mínimo de 40px e ~32px, abaixo de 44px | Toques falhados no telemóvel | `min-h/min-w` 44px em `pointer: coarse` | S | Baixo |
| U-B04 | Finanças, mudar de mês | pages/Finance.tsx:178; hooks/useFinance.ts:48-55 | Ao mudar de mês os dados antigos ficam sem indicador de carga. Se o pedido falha com `data` já presente, `error && !data` é falso e não aparece erro: título do mês novo com valores do anterior. Sem proteção contra respostas fora de ordem | Valores errados sob o mês errado | Limpar `data` ou skeleton ao mudar `month`; mostrar erro; AbortController | S | Baixo |
| U-B05 | Finanças, gravar/apagar | hooks/useFinance.ts:76-87, :93-107, :186-195 | Escritas com sucesso não dão toast (só erros) | Incerteza ao gravar/apagar | `notify(..., 'success')` curto em `run`/`runCreate` | S | Baixo |
| U-B06 | Finanças, apagar | pages/Finance.tsx:105-151 | Apagar movimento, conta, meta ou investimento só confirma, sem desfazer (só pagamentos de dívidas têm undo). Apagar regra recorrente remove todas as ocorrências | Perda irreversível | Toast com "Desfazer" (recriar com o mesmo payload) | M | Médio |
| U-B07 | Finanças, apagar com falha | pages/Finance.tsx:112-114 | `run` devolve `false` em falha mas o diálogo ignora o booleano e fecha como se tivesse corrido bem (só o toast de useFinance.ts:84 avisa) | Diálogo sugere sucesso | Lançar erro quando `false` | S | Baixo |
| U-B08 | Finanças, lista de movimentos | components/Finance/FinanceEntries.tsx:41; pages/Finance.tsx:169-177 | Sem pesquisa, ordenação, filtro por categoria/conta nem seleção múltipla; sem botão "Mês atual" | Difícil achar ou apagar vários | Pesquisa, filtros, botão "Hoje" | M | Baixo |
| U-B09 | Finanças, orçamento | components/Finance/FinanceOverview.tsx:113, :123, :21 | Guardar sem estado de carga (duplo envio) nem toast; "Editar" é link `text-sm` sem área de toque; sem orçamentos não há convite a definir um (BudgetLine devolve null) | Duplo envio, pouca descoberta | `disabled`/spinner; estado vazio com CTA | S | Baixo |
| U-B10 | Finanças, metas | components/Finance/FinanceGoals.tsx:196,208 | Quick-edit de poupado/plano usa `void onUpdate(...)`: sem spinner nem feedback local | Sem feedback do pedido | `isSaving` por linha | S | Baixo |
| U-B11 | Finanças, importar/exportar | components/Finance/FinanceImportButton.tsx:90; FinanceExportButton.tsx:59 | Botões à mão com `py-1.5` (~32px), fora do componente Button; exportar com sucesso sem toast; importar só aceita o CSV do próprio export, sem arrastar-e-largar | Inconsistência, alvo pequeno | Usar Button, toast, zona de drop | S | Baixo |
| U-B12 | Humor | api/wellbeingService.ts:24; BE wellbeing.controller.ts:88 | DELETE de humor existe no BE e no FE mas nenhuma UI o chama: um registo errado só se substitui. Só se vê um dia de cada vez | Dado errado fica para sempre | "Limpar registo" no MoodCheckInCard; mini-calendário | S/M | Baixo |
| U-B13 | Humor, dia a dia | components/Wellbeing/MoodCheckInCard.tsx:33-38, :61 | O efeito repõe os campos quando `mood.log` ou `mood.day` mudam: trocar de dia com as setas descarta o que foi escrito | Perde-se nota escrita | Avisar ou guardar rascunho por dia | S | Baixo |
| U-B14 | Medicação, edição | components/Wellbeing/MedicationsCard.tsx:116,328,160 | `editing` é um só estado: abrir a edição de outro medicamento fecha o formulário atual e perde o escrito; "Adicionar" some enquanto se edita | Perda de formulário | Confirmar ao trocar ou formulários independentes | S | Baixo |
| U-B15 | Medicação, pausar | components/Wellbeing/MedicationsCard.tsx:321-327 | "Pausar/Retomar" é `text-xs px-1.5` (~20px) sem estado de carga nem toast de sucesso | Alvo minúsculo | Subir área de toque, toast | S | Baixo |
| U-B16 | Medicação, checklist | components/Wellbeing/MedicationsCard.tsx:33-34 | Checkbox 16px em linha ~36px | Alvo pequeno em ação diária | `py-3` ou checkbox 24px | S | Baixo |
| U-B17 | Tomas avulso | BE wellbeing.controller.ts:195-218; FE MedicationsCard.tsx:279; useMedications.ts:26 | Sem edição (BE só POST/GET/DELETE): corrigir hora/dose obriga a apagar e recriar. Confirmar apagar uma linha de baixo risco sem desfazer. Lista só 7 dias, sem "ver mais" | Fricção de correção; histórico antigo inacessível | PATCH `intakes/:id`; toast com desfazer; "ver mais" | M | Baixo |
| U-B18 | Dádivas de sangue | components/Wellbeing/BloodDonationsCard.tsx:134; BE wellbeing.controller.ts:146-170 | Sem edição (BE sem PATCH); data em ISO bruto `{d.date}` não localizada; sem paginação | Corrigir data = apagar e recriar | PATCH; `toLocaleDateString(lang)` | S/M | Baixo |
| U-B19 | Histórico de medicação | components/Wellbeing/MedicationHistoryCard.tsx:62 | Barras diárias só com `title` (hover): em touch não há valor; sem exportar | Dados ilegíveis em telemóvel | Toque mostra dia/valor; CSV | S/M | Baixo |
| U-B20 | Bem-estar, recarga | hooks/useMedications.ts:46-57 | Se o `load()` pós-gravação falhar, `setError(true)` troca o cartão inteiro por erro apesar de a escrita ter funcionado | Parece que falhou | Manter dados e avisar discretamente | S | Baixo |
| U-B21 | Horário, aulas | BE schedule.controller.ts:154-183; FE api/scheduleService.ts:82; ImportScheduleModal.tsx:172 | Não há criar, editar nem apagar uma aula individual (só .ics, presença, cancelar, apagar tudo). O apagar por intervalo existe no BE e em `deleteImportedClasses(range)` mas a UI só oferece "apagar tudo", escondido no modal de importação | Correção manual impossível; ação destrutiva pouco descobrível | Formulário nova/editar aula; "apagar esta semana/intervalo" | L | Médio |
| U-B22 | Horário, turnos | components/Schedule/commitments/ShiftRow.tsx:117, :89-98 | Apagar turno é imediato, sem confirmação nem desfazer; apagar local confirma (CommitmentSection.tsx:109). "Mover para" tem `py-0.5` e age ao escolher | Perda acidental; inconsistência | Toast com desfazer; área de toque maior | S | Baixo |
| U-B23 | Horário, exceções | components/Schedule/ScheduleChangesCard.tsx:89, :43-44, :101, :158-159 | Apagar folga/férias sem confirmação nem desfazer; sem editar (BE sem PATCH); `from`/`to` iniciais fixados na montagem (ficam no dia anterior depois da meia-noite); `to` não acompanha `from` (só o submit avisa); sem toast ao criar | Erros de datas, trabalho refeito | Auto-ajustar `to`; PATCH; toast com desfazer | S/M | Baixo |
| U-B24 | Horário, escritas sem toast | hooks/useCommitments.ts:50-56; components/Schedule/ShiftChangeModal.tsx:49-51 | Locais, turnos e exceções gravam sem toast de sucesso (cancelar aula tem, WeekGrid.tsx:88); erro vai para string no topo do cartão | Inconsistência entre ações iguais | Toast uniforme | S | Baixo |
| U-B25 | Horário, alvos de toque | components/Schedule/WeekDayCell.tsx:146-151; AttendanceToggle.tsx:41 | Botões cancelar aula e presença 24x24px (h-6 w-6), três por aula | Falham toques no telemóvel | 44px em `pointer: coarse` | S | Baixo |
| U-B26 | Títulos sem i18n | pages/Schedule.tsx:33; Appeals.tsx:13; Areas.tsx:68; Dashboard.tsx:78; FeedbackAdmin.tsx:33; Focus.tsx:20; Tasks.tsx:45 | `useDocumentTitle('...')` com texto inglês fixo; as outras páginas usam `t()` | Separador em inglês nas 8 línguas | Usar `t('nav...')` | S | Baixo |
| U-B27 | Horário, importar | components/Schedule/ImportScheduleModal.tsx:48-56 | `onImported()` (setState no pai) chamado no corpo do render do filho | Aviso "Cannot update a component while rendering", risco de ciclo | Mover para `useEffect` | S | Baixo |
| U-B28 | Horário, feed .ics | components/Schedule/CalendarFeedCard.tsx:80-82 | `loadFailed` ou `status === null` devolve `null`: o cartão desaparece sem erro nem retry | Sem recuperação de erro temporário | Estado de erro com "Tentar outra vez" | S | Baixo |
| U-B29 | Agente, configuração | pages/Agent.tsx:55-60, :120-124 | Rascunho sem indicador de "por gravar", sem repor, sem aviso ao sair; "Guardado" é texto local com `setTimeout` sem limpeza, não toast | Alterações perdidas ao navegar | Indicador, `beforeunload`, toast | S | Baixo |
| U-B30 | Agente, listas de bloqueio | components/Agent/BlockListEditor.tsx:28-34 | Duplicado ou domínio inválido limpa o campo sem mensagem; não aceita colar vários | Parece que nada aconteceu | Mensagem inline; separar por vírgula/linha | S | Baixo |
| U-B31 | Developer, chaves API | hooks/useApiKeys.ts:76-80; components/Developer/ApiKeysTable.tsx:12,47 | Revogar com falha só faz `console.error` e a chave reaparece sem aviso; datas fixas em `'en-GB'`; `key.scope` cru ("TASKS"/"ADMIN"); sem renomear (BE sem PATCH); tabela só com scroll horizontal no telemóvel | Falha silenciosa; i18n e mobile | Toast de erro; `lang`; rótulos traduzidos; cartões em mobile | S | Baixo |
| U-B32 | Admin, Security: banir IP | pages/Security.tsx:57, :34-37 | `key={banRequest.nonce}` remonta o BannedIpsCard a cada "Ban" numa linha: perde o motivo escrito e volta a pedir dados. A página tem outra instância de `useBannedIps`, por isso o badge "banido" nos logs só atualiza com refresh | IP banido continua com botão "Ban" | Elevar `useBannedIps` ao pai; `useEffect` para o prefill | S | Baixo |
| U-B33 | Admin, IPs banidos | components/Security/BannedIpsCard.tsx:90 | Desbanir e banir sem confirmação; sem data/autor; sem pesquisa; sem expiração | Banir o IP errado (ex.: o próprio) é um clique | Confirmar, mostrar data, pesquisa | S | Baixo |
| U-B34 | Admin, Security logs | hooks/useSecurityLogsPage.ts:75-77; components/Security/SecurityLogsFilters.tsx:79-92 | Cada tecla em IP/Path dispara um pedido (sem debounce), com respostas possíveis fora de ordem; sem exportar, ordenar nem atualizar; purga só 30 dias ou tudo; tabela `whitespace-nowrap` com scroll horizontal | Carga no BE e lista a saltar | Debounce 300 ms, atualizar, CSV | S | Baixo |
| U-B35 | Admin, Utilizadores | pages/Users.tsx:45; components/Users/UsersTableHeader.tsx:8; UserTableRow.tsx:66 | Pesquisa existe, mas sem ordenar, filtrar por papel/estado nem paginar; data de adesão `toLocaleDateString()` sem língua; até 5 IconButtons por linha em tabela com scroll | Difícil achar suspensos/ADMIN | Ordenar, filtros, paginação, `lang` | M | Baixo |
| U-B36 | Admin, Appeals | hooks/useAppealsPage.ts:65; components/Appeals/AppealRow.tsx:29-31; BE appeals.service.ts:111 | O BE suporta `status=all` mas a UI pede sempre `pending`: sem histórico de decididos. Aprovar/negar sem estado de carga: a linha sai otimista e duplo clique é possível | Sem registo para consulta; duplo envio | Separador "Resolvidos"; botão desativado ao enviar | S | Baixo |
| U-B37 | Admin, Feedback | pages/FeedbackAdmin.tsx:77-80; components/Feedback/FeedbackAdminItem.tsx:20-21,110 | Só filtro aberto/fechado; sem pesquisa nem filtro por categoria/língua; sem paginação (só aviso de limite); botões de ação `text-xs` sem área de toque; categoria crua (`item.category`); datas `toLocaleString()` sem língua | Triagem lenta com muito feedback | Pesquisa + categoria, rótulos traduzidos | M | Baixo |
| U-B38 | Feedback (utilizador) | pages/MyFeedback.tsx:30-67 | Só leitura: sem CTA para enviar feedback no estado vazio, sem editar/apagar o próprio (BE sem PATCH/DELETE), sem responder à resposta da equipa, sem refrescar; datas sem língua | Beco sem saída depois de uma resposta | CTA "Enviar feedback" e seguimento | S | Baixo |
| U-B39 | Admin, Pads | pages/PadsAdmin.tsx:46; BE pads.service.ts:245 | Só os últimos N pads, sem pesquisa por slug nem paginação; botões `py-1 text-xs`; sem lista de fontes bloqueadas (só se bloqueia a partir de um pad) | Pad antigo inalcançável | Pesquisa por slug, lista de bloqueados | M | Baixo |
| U-B40 | Admin, Tipos | pages/TaskTypes.tsx:80,106 | Reordenar só pelo número `order` no formulário; desativar sem confirmação nem aviso do impacto nas tasks existentes | Ordem difícil de gerir | Arrastar para reordenar; aviso ao desativar | M | Médio |
| U-B41 | Social, notas (lado leitor) | components/Social/SocialLists.tsx:67-70; pages/FriendProfile.tsx:302-322; api/socialNotesService.ts:67; BE notebook-view-grant.service.ts:220-228 | Pedido enviado só mostra "pedido enviado"; não há cancelar nem deixar de ler um caderno aprovado, embora o BE permita ao leitor e `removeGrant` exista | Preso a um pedido pendente | "Cancelar pedido" / "Deixar de ver" com `removeGrant` | S | Baixo |
| U-B42 | Social, revogar acesso | components/Social/NotesAccessPanel.tsx:122, :107 | O dono revoga o acesso de imediato, sem confirmação (bloquear pede confirmação, SocialLists.tsx:103); recusar pedido também sem confirmação nem estado de carga | Revogação acidental | Confirmar ou toast com desfazer | S | Baixo |
| U-B43 | Social, listas | components/Social/SocialLists.tsx:112-125, :58-61 | Amigos sem pesquisa/ordenação; remover e bloquear só dentro do perfil, com confirmação inline diferente do ConfirmDialog usado noutras páginas; botões Aceitar/Recusar `px-2.5 py-1` (~28px) sem estado de carga; interruptor de pedidos por email (pages/Social.tsx, `void setAllowEmailRequests`) sem feedback de erro | Inconsistência e alvos pequenos | Pesquisa, unificar confirmações, `disabled` ao enviar | M | Baixo |
| U-B44 | Social, notas de amigo | pages/FriendNotes.tsx:57-80 | Lista sem filtro por cadeira, pesquisa, ordenação nem paginação | Lista longa impossível de percorrer | Filtro por cadeira + pesquisa | S | Baixo |
| U-B45 | Social, escolha de áreas | components/Social/NotesAccessPanel.tsx:46-62 | Sem "selecionar todas" ao aprovar ou alterar áreas | Muitos cliques com muitas cadeiras | Botão "Todas" | S | Baixo |
| U-B46 | Global, datas sem língua da app | components/Security/SecurityLogRow.tsx:32; Tasks/TaskHistorySection.tsx:29,35; Users/UserStatusBadge.tsx:29; Appeals/AppealRow.tsx:59; AccountBlocked/AccountBlockedPage.tsx:39 | `toLocaleString()`/`toLocaleDateString()` sem argumento usam a língua do browser, não a escolhida na app | Mistura de formatos | Passar `lang` | S | Baixo |

## 7. Matriz CRUD por entidade

Legenda: SIM/NAO (grupo A) e S/N/P (grupo B, P = parcial). Os buracos mais importantes: coisas que se criam mas não se editam (aulas, tomas avulso, dádivas de sangue, exceções de horário, chaves API, anexos, packs, feedback do utilizador, quizzes), apagar sem desfazer (quase tudo), pesquisa e filtro em falta (tarefas em /tasks, movimentos de finanças, quizzes, flashcards, notas pessoais), exportar em falta (contas, metas, flashcards, quizzes, notas, boletim só imprime).

### 7.1 Grupo A

Abreviaturas: FE = frontend, BE = backend (controller). "n/a" = não faz sentido.

| Entidade | Criar | Ler | Editar | Apagar | Desfazer | Ordenar | Filtrar | Pesquisar | Exportar | Importar | Arquivar | Bulk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tarefa | SIM FE `TaskForm.tsx:130`, BE `tasks.controller.ts:61` | SIM `Tasks.tsx:197` | SIM `TaskEditForm.tsx:115`, BE `:183` | SIM com confirmação `useTasksPage.ts:299`, BE `:201` | Só "concluir" `useCompleteWithUndo.ts:40`; apagar NAO | SIM manual/data/prioridade `Tasks.tsx:125`, BE `:142` | NAO em /tasks; SIM no Dashboard `DashboardFilters.tsx:76` | NAO em /tasks; SIM no Dashboard `:79` | SIM só Dashboard `TaskExportButtons.tsx:20` | SIM Excel/CSV `TaskImportModal.tsx:34`, BE `:164` | SIM automático `Tasks.tsx:110` | SIM só Dashboard `BulkActionsBar.tsx:42`; BE `:105-150` |
| Subtarefa | SIM `SubtaskChecklist.tsx:37` | SIM | NAO só estado: título tem PATCH BE `subtasks.controller.ts:82` e FE `subtasksService.ts:20`, sem UI | SIM sem confirmação `:63` | NAO | SIM drag HTML5 `:87` | n/a | n/a | n/a | SIM bulk na criação `useTasksPage.ts:181` | n/a | NAO |
| Anexo de tarefa | SIM `TaskAttachmentsSection.tsx:34` | SIM `:65` | NAO, BE sem PATCH `task-attachments.controller.ts:41-81` | SIM com confirmação `:69` | NAO | NAO | n/a | n/a | SIM download `AttachmentActions` | n/a | n/a | NAO |
| Modelo de tarefa | SIM `TaskTemplatePicker.tsx:33` | SIM | NAO (só substituir pelo mesmo nome `useTaskTemplates.ts:43`) | SIM sem confirmação `:78` | NAO | SIM por nome `:49` | n/a | NAO | NAO | NAO | n/a | NAO; só localStorage `:9` |
| Pack de tarefas | SIM `CreateTaskPackModal.tsx:53`, BE `task-packs.controller.ts:39` | SIM | NAO, BE sem PATCH `:26-119` | SIM `TaskPackList.tsx:79`, BE `:119` | NAO | NAO | NAO | NAO | SIM link/código `:31` | SIM `ImportTaskPack.tsx:29`, BE `:91` | n/a | NAO |
| Tipos de tarefa (admin) | SIM `TaskTypes.tsx:131` | SIM | SIM `:147`, BE `task-types.controller.ts:49` | Desativar sem confirmação `TaskTypesTable.tsx:63` | NAO (reativar SIM `:72`) | SIM por `order` | NAO | NAO | NAO | NAO | SIM (desativar) | NAO |
| Área | SIM `Areas.tsx:410`, BE `areas.controller.ts:62` | SIM | SIM `:426`, BE `:159` | SIM `useAreasPage.ts:144`, BE `:174` | NAO | SIM manual+critérios `Areas.tsx:133-141` | SIM `AreaToolbar` | SIM | NAO | NAO | Ocultar só oficiais `AreaCard.tsx:104`; pessoais NAO | Parcial: regras em massa `Areas.tsx:371`, ocultar todas `:333` |
| Programa | SIM `CreateProgramModal.tsx:29`, BE `programs.controller.ts:42` | SIM | SIM só nome/arredondamento `RenameProgramModal.tsx:52`; `isActive` no BE `update-program.dto.ts:14` sem UI | SIM `ProgramSelector.tsx:75`, BE `:64` | NAO | NAO | NAO | NAO | NAO | NAO | NAO (BE sem restore; inativos escondidos `:108`) | NAO |
| Período | SIM `ManagePeriodsModal.tsx:152`, BE `periods.controller.ts:32` | SIM | SIM `:81`, BE `:40` | NAO, BE sem DELETE | SIM restaurar `:100` | SIM por data `PeriodSelector.tsx:44` | SIM ver arquivados `:121` | NAO | NAO | NAO | SIM `:100`, BE `:53-66` | NAO |
| Componente de nota | SIM `GradeComponentsPanel.tsx:86`, BE `grade-components.controller.ts:102` | SIM | SIM `GradeComponentCard.tsx:37`, BE `:114` | SIM com confirmação `:130` | NAO | NAO | n/a | NAO | NAO | NAO | NAO | NAO |
| Nota (entry) de componente | SIM `GradeComponentCard.tsx:68` | SIM | Só valor `GradeEntryChip.tsx:19`; BE aceita label/data `grade-entry.dto.ts` (PartialType) | SIM sem confirmação `GradeEntryChip.tsx:58` | NAO | NAO | n/a | n/a | n/a | n/a | n/a | NAO |
| Boletim de período | n/a (calculado) | SIM `ReportCard.tsx:82`, BE `periods.controller.ts:104` | n/a | n/a | n/a | NAO | SIM escolher período `:93` | NAO | Só imprimir `:108` | n/a | n/a | n/a |
| Previsão / nota necessária | n/a | SIM `GradeProjectionCard.tsx:89`, `GradeNeededCalculator.tsx:25` | Cálculo local, valor não guardado `:35` | n/a | n/a | n/a | SIM por cadeira `:34` | n/a | NAO | n/a | n/a | n/a |
| Entrada do Caderno | SIM `Notebook.tsx:208`, BE `notebook.controller.ts:137` | SIM | SIM autosave `NotebookEntryEditor.tsx:204`, BE `:145`; mover de cadeira NAO (`upsert-notebook-entry.dto.ts:369`) | SIM só em modo edição `EntryToolbar.tsx:189` | SIM undo de texto `:192`; apagar NAO | NAO (sempre mais recente primeiro) | SIM tipo, só com >=6 `NotebookEntryList.tsx:29` | SIM global `Notebook.tsx:260`; local só título `:48` | SIM .md `:184-206` | NAO | NAO | NAO |
| Nota pessoal | SIM `PersonalNoteForm.tsx:34`, BE `personal-notes.controller.ts:40` | SIM | SIM `PersonalNoteItem.tsx:45`, BE `:52` | SIM com confirmação `PersonalNotes.tsx:28` | NAO | Fixa (ordem automática) `usePersonalNotes.ts:15` | NAO | NAO | NAO | NAO | Marcar feita `PersonalNoteItem.tsx:64` | NAO |
| Pad | SIM implícito `Pad.tsx:53`, BE `pads.controller.ts:119` | SIM | SIM autosave `usePad.ts:31` | Só ADMIN `PadEditor.tsx:64`, BE `:166` | Ctrl+Z nativo | n/a | n/a | n/a | Só copiar link `PadEditor.tsx:52` | NAO | NAO | NAO |
| Flashcard | SIM `CardEditor.tsx:35`, BE `flashcards.controller.ts:63` | SIM | SIM `useFlashcards.ts:80`, BE `:83` | SIM com confirmação `Flashcards.tsx:69` | NAO (nem nota da revisão `ReviewSession.tsx:35`) | NAO | SIM área/difíceis `Flashcards.tsx:120-139` | NAO | NAO | SIM texto `ImportCardsModal.tsx:40`, BE `:73` | NAO | Só importar |
| Quiz | Só importar JSON `QuizUploadModal.tsx:57`, BE `quizzes.controller.ts:48` | SIM | Renomear: BE `quizzes.controller.ts:66` + FE `quizzesService.ts:74`, sem UI. Perguntas NAO | SIM com confirmação `QuizDetail.tsx:287` | NAO | NAO | NAO | NAO na lista `Quizzes.tsx:88`; SIM no banco `QuizHome.tsx:369` | NAO | SIM (é a criação) | NAO | NAO |
| Tentativa de quiz | SIM `QuizDetail.tsx:193` | SIM `QuizHome.tsx:420` | n/a | Só tudo `QuizHome.tsx:404`, BE `:99` | NAO | Mais recente primeiro | NAO | NAO | NAO | n/a | n/a | n/a |
| Partilha de quiz | SIM `QuizShareModal.tsx:135`, BE `quiz-share.controller.ts` / `quizzes.controller.ts:157` | SIM `QuizShareLists.tsx:44,78` | n/a | SIM revogar com confirmação `:120`; remover destinatário sem `:173` | NAO | NAO | NAO | NAO | n/a | SIM adicionar cópia `SharedQuiz.tsx:43` | n/a | NAO |

### 7.2 Grupo B

| Entidade | Criar | Ler | Editar | Apagar | Desfazer | Ordenar | Filtrar | Pesquisar | Exportar | Importar | Arquivar | Bulk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Finanças: movimentos | S FinanceEntryForm | P só mês (Finance.tsx:60) | S FinanceEntries.tsx:74 | S :77 (confirma) | N | N | N | N | S CSV total | S só CSV próprio | N | N |
| Finanças: contas | S | S | S FinanceAccounts.tsx:154 | S :170 | N | N | N | N | N | N | N | N |
| Finanças: investimentos | S | S | S FinanceHoldings.tsx:223 | S :77 | N | N | N | N | N | N | N | N |
| Finanças: orçamentos | P só 2 limites globais (FinanceOverview.tsx:139) | S | S :78 | P limpar campo | N | N | N | N | N | N | N | N |
| Finanças: metas | S | S | S FinanceGoals.tsx:272 | S :158 | N | N | N | N | N | N | N | N |
| Finanças: dívidas | S | S | S | S | P só pagamentos (useFinance.ts:133) | N | N | N | N | N | N | N |
| Humor | S MoodCheckInCard.tsx:40 | P 1 dia de cada vez | S upsert (BE mood.service.ts:65) | N UI (BE DELETE wellbeing.controller.ts:88; FE wellbeingService.ts:24 sem uso) | N | N | N | N | N | N | N | N |
| Medicação | S MedicationsCard.tsx:163 | S | S :328 | S :331 | N | N | N | N | N | N | P pausar :321 | N |
| Doses (checklist) | S toggle :256 | S 30 dias | S | S | S (toggle) | N | N | N | N | N | N | N |
| Tomas avulso | S IntakeLogModal | P só 7 dias (useMedications.ts:26) | N (BE sem PATCH, wellbeing.controller.ts:195-218) | S :279 (confirma) | N | N | N | N | N | N | N | N |
| Histórico medicação | n/a | S 7/30 dias | n/a | n/a | n/a | N | P período | N | N | n/a | n/a | n/a |
| Dádivas de sangue | S | S | N (BE sem PATCH, wellbeing.controller.ts:146-170) | S BloodDonationsCard.tsx:141 | N | N | N | N | N | N | N | N |
| Sono / outros | N: não existe entidade (só "sleep" em i18n auto.ts) | | | | | | | | | | | |
| Aulas (ocorrências) | P só via .ics | S | N (BE só PATCH attendance/cancelled, schedule.controller.ts:154,167) | P só todas (ImportScheduleModal.tsx:65); intervalo só no BE (schedule.controller.ts:183) | S cancelar/repor (WeekDayCell.tsx:146) | n/a | N | N | S feed .ics | S .ics | N | P apagar tudo |
| Presenças | S AttendanceToggle | S | S | S (null) | S | N | N | N | N | N | N | N |
| Turnos de trabalho | S | S | S ShiftRow.tsx:114 | S :117 sem confirmar | N | N | N | N | N | N | N | P copiar semana (BE work-shifts.controller.ts:74) |
| Locais (commitments) | S | S | S | S CommitmentSection.tsx:109 confirma | N | N | N | N | N | N | N | N |
| Exceções (folgas/férias) | S ScheduleChangesCard.tsx:99 | S | N (BE só POST/DELETE, schedule-exceptions.controller.ts:37,50) | S :89 sem confirmar | P só pelo modal do turno (ShiftChangeModal.tsx:58) | N | N | N | N | N | N | N |
| Config do agente | n/a | S | S Agent.tsx:55 | N | N | N | N | N | N | N | N | N |
| Chaves API | S Developer.tsx:42 | S | N (BE só POST/DELETE, auth.controller.ts:973-997) | S :50 confirma | N | N | N | N | N | N | N | N |
| Dispositivos (sessões) | n/a | S | N | S Devices.tsx:26 | N | N | N | N | S export de atividade | N | N | S terminar outras :41 |
| Amigos / pedidos | S AddFriendForm | S | N | S no perfil (FriendProfile.tsx:276) | N | N | N | N | N | N | N | N |
| Bloqueios | S | S | n/a | S | S desbloquear | N | N | N | N | N | N | N |
| Acessos às notas (grants) | S | S | S áreas NotesAccessPanel.tsx:115 | S dono :122 sem confirmar; N lado leitor (BE permite, notebook-view-grant.service.ts:220) | N | N | N | N | N | N | N | N |
| Feedback (utilizador) | S FeedbackModal | S MyFeedback.tsx | N | N | N | N | N | N | N | N | N | N |
| Feedback (admin) | n/a | S | P resposta | P recusar | P reabrir | N | S aberto/fechado | N | N | N | S resolver | N |
| Appeals (admin) | n/a | P só pendentes (useAppealsPage.ts:65) | n/a | n/a | N | N | N | N | N | N | N | N |
| Utilizadores (admin) | N | S | S Users.tsx:90 | S | S reativar | N | N | S Users.tsx:45 | S :91 | N | N | N |
| Task types / subcategorias / prioridades | S | S | S | P só desativar (BE DELETE desativa, task-types.controller.ts:61) | S reativar | P campo `order` | N | N | N | N | S | N |
| Pads (admin) | n/a | P últimos N (BE pads.service.ts:245) | n/a | S PadsAdmin.tsx:81 | N | N | N | N | N | N | n/a | N |
| IPs banidos | S | S | N | S BannedIpsCard.tsx:90 sem confirmar | S | N | N | N | N | N | N | N |
| Security logs | n/a | S paginado | n/a | S purge 30d/tudo | N | N | S ip/path/janela | P | N | N | n/a | S purge |
| Sessões de estudo (Focus) | S manual | S | S SessionHistoryCard.tsx:133 | S :134 | N | N | P intervalo de dias | N | N | N | N | N |
| Turmas, Perfil, Dashboard, Home, WeeklyReview | não cobertos em profundidade (secção 3) | | | | | | | | | | | |

## 8. Migrações sugeridas (nenhuma foi escrita nem aplicada)

O Prisma 6 não suporta índices parciais de forma declarativa: onde a coluna diz "SQL manual", criar com `npx prisma migrate dev --create-only --name <nome>` e acrescentar o SQL à mão antes de aplicar. Quem corre as migrações é o utilizador.

| `--name` sugerido | Achados | Nota |
|---|---|---|
| `task_submission_date_index` | B-21 | `@@index([submissionDate])`, idealmente parcial |
| `fk_indexes` | B-22 | índices nas FK sem índice; priorizar as do apagar conta e export |
| `study_session_one_active` | B-23 | `UNIQUE INDEX ("userId") WHERE "endedAt" IS NULL`, SQL manual; apanhar P2002 como 409 |
| `drop_redundant_indexes` | B-30 | antes, confirmar `idx_scan` em produção (`pg_stat_user_indexes`) |
| `area_official_name_unique` | B-31 | `UNIQUE (lower(name)) WHERE "ownerId" IS NULL`, SQL manual; limpar duplicados antes |
| `notebook_search_trgm` (opcional) | B-24 / S-08 | `pg_trgm` com índice GIN |
| `pack_item_legacy_checked` (opcional) | B-35 | flag para não repetir a procura de origem |
| `two_factor_attempts` (opcional) | S-10 | só se o contador de tentativas for persistente |
| (endpoints novos, sem migração) | U-A15 (PATCH pack), U-B17 (PATCH toma), U-B18 (PATCH dádiva), U-B23 (PATCH exceção) | só DTO, controller e service |

Todos os restantes achados não precisam de migração.

## 9. Verificação própria (feita por mim, em código)

Reli e confirmei diretamente, depois de os agentes terem reportado:

- `frontend/src/components/UI/Modal.tsx:46-54` (Escape fecha sempre) e `:101-104` (`onClick={onClose}` no fundo): confirma U-A01, U-B01, T-01, U-B02.
- `backend/src/users/users.controller.ts:46`: `GET me/export` só tem `@UseGuards(JwtAuthGuard)`, sem `@Throttle`: confirma B-20/S-03. `backend/src/prisma/prisma.service.ts:32`: `DEFAULT_CONNECTION_LIMIT = 10`.
- `backend/src/tasks/tasks.service.ts:1013-1042` (`bulkUpdateStatus`): só `updateMany`, sem `spawnFollowUps`, sem histórico, e dois `updateMany` seguidos fora de transação no ramo de reabrir: confirma S-01 e B-29.
- `backend/prisma/schema.prisma:912`: `submissionDate` sem `@@index`: confirma B-21.
- `frontend/src/api/quizzesService.ts:74`: `renameQuiz` existe e não é usado em nenhum `.tsx`: confirma U-A02.
- `useDocumentTitle('Tasks')`, `('Areas')`, `('Schedule')` em `pages/Tasks.tsx:45`, `pages/Areas.tsx:68`, `pages/Schedule.tsx:33`: confirma U-A09 e U-B26.
- O script `node frontend/scripts/check-i18n.mjs` (corrido pelo agente transversal) reportou 4689 chaves, 8 línguas, 0 em falta.

Os restantes achados são traço do agente da área (ficheiro:linha dado, leitura do código feita pelo agente). Divergência a anotar: B-25 descreve o `reorder` de tarefas como um `update` por id; o excerto que reli (`tasks.service.ts:323-334`) mostra um `updateMany` com incremento seguido da transação, por isso rever o corpo completo antes de corrigir.

## 10. O que NÃO foi verificado

- **Browser.** Não abri a aplicação no browser nem testei viewport mobile: todas as fricções de UI vêm de leitura de código. Em particular não foram confirmados em execução: alvos de toque abaixo de 44px, teclado a tapar inputs, scroll horizontal das tabelas, texto cortado por `truncate`, flicker dos cartões (F-05, F-25). Fica como passo seguinte, a fazer com o utilizador autenticado numa sessão separada.
- **Agente Go (`agent/`).** Não auditado nesta passagem (o pedido focava arquitetura e UX da app web). Para o agente usar a auditoria de segurança dedicada.
- **Segurança profunda.** Os achados de segurança aqui são os colaterais (throttle, logs, ownership, erros). Isto não substitui uma auditoria de segurança completa nem `npm audit`.
- **Desempenho medido.** Sem `EXPLAIN ANALYZE`, sem estatísticas de produção, sem medição de renders ou de bundle atual (o `dist/` existente é de 2026-11-01 e pode estar desatualizado). Os achados de índices e N+1 vêm do schema e das queries.
- **Zonas só parcialmente analisadas:** Turmas, Perfil, Dashboard, Home, Today e WeeklyReview (sem matriz CRUD nem achados de edição/ordenação em profundidade); Focus só tem a verificação de edição e apagar das sessões; auth (sessões, 2FA, OAuth) e security-logs foram vistos só pelas queries; `schedule-sync.service.ts`, `calendar.service.ts` e `work-shifts.service.ts` só quanto a `userId` e janelas.
- **Marcados "a confirmar" pelo agente:** F-03 (insights vs doações), F-31 (quatro renderizações de tarefa), F-40 (memoização do WeekGrid, o React Compiler pode já cobrir). Verificação de emojis no código: o grep falhou no motor, por isso a ausência de emojis não está confirmada; verdes e em dashes confirmados (só em dois testes, intencionais).
- **Comportamento de backend por confirmar:** se `bulk-delete` é soft ou hard (U-A, não verificado), se o frontend ainda chama `findAllForArea` sem paginação (B-45).
- Textos exatos das chaves `hook.*` nas 8 línguas, e tabelas de TaskTypes em mobile (cartões ou scroll): não verificado.

## 11. Estado das correções (2026-11-22)

Quick wins da secção 2.1 e os itens 1 a 4 da secção 2.2 foram tratados em duas vagas; a fase 2 de backend (11.1b, 11.5, 11.6) fechou os achados B e S pendentes, exceto os testes S-04, S-18 e S-36. Verificação: `tsc` limpo no frontend e no backend, `check-i18n` com 4800 chaves e 0 problemas, jest do backend 190 suites e 1773 testes, vitest do frontend 953 testes. A maior parte foi testada em execução na secção 11.4 (2026-11-22, browser embutido, backend e frontend locais, conta real, dados de teste com prefixo "ZZ-teste" apagados no fim). Nada foi commitado.

### 11.1 Corrigido

| Achados | O que foi feito |
|---|---|
| B-20, S-03, S-06, S-07, S-12 | `@Throttle` no export RGPD (2 por minuto), avatar, sync do Google Calendar e `decideAccessRequest` (este só envia push quando o estado muda). A lógica do sync passou para `CalendarService`. |
| B-21, B-22 | Índices em `schema.prisma`, migração `task_submission_date_index` aplicada (inclui os índices FK). |
| B-23, B-31 | Código preparado: P2002 vira 409. Os índices únicos parciais ainda não existem (ver 11.3). |
| B-24, S-08 | Pesquisa do caderno filtrada em SQL, com DTO, limite de 200 caracteres, throttle e resposta só com resumo (sem URLs assinados). |
| B-25 | `reorder` com um único `UPDATE` por `unnest`, com `userId`. |
| B-26 | Import de tarefas em lote com `sortOrder` correto. |
| B-27 | Import de pacote grava `packItemId` no create e, em modo substituir, só apaga depois dos creates. |
| B-29, S-01 | `applyCompletionSideEffects` partilhado: concluir em massa e pelo check-in gera recorrência, desbloqueia dependentes e grava histórico. Reabrir em massa corre numa transação. |
| S-02 | `applyLinkedDeadlineChange` valida o peso por utilizador e área e grava histórico. |
| B-41, B-43 | `remove` de tarefa com `deleteMany`. `userId` nos `where` de escrita onde era trivial. |
| S-13, S-35 | Logs só com `id` e `role`, sem email nem query string. Email do conflito OAuth no fragmento `#`. |
| S-14 | `PrismaExceptionFilter` global. |
| S-26, S-27, S-28, S-30 | `safeEqual`, `prisma-errors`, `assertTaskOwned`, constantes de tempo e fuso. |
| F-01, F-05, F-17, U-B34 | Refetch por `meds.version`, Focus sem piscar, dívidas só quando mudam, debounce nos security logs. |
| F-04, F-06, F-07, F-08, F-10, F-11, F-12, F-14 | Mecanismo `lib/domainEvents.ts` (domínios `tasks`, `studySessions`, `grades`, `areaTeachers`, `ratings`). Os cartões do Focus, do Dashboard, das Áreas e do Social atualizam depois de mutações. |
| F-44, F-45, F-52, F-53 | `advancedChunks` no Vite (`index` de cerca de 405 KB para 195 KB), lazy load, constantes `STORAGE_KEYS` e `POLL_MS`. |
| U-A01, U-B01, U-B02 | Pilha de modais (Escape fecha só o de cima) e prop `isDirty` ligada a criar e editar tarefa, editar movimento e importar cartões. |
| U-A02, U-A03, U-A24, U-B12, U-B36, U-B41, U-A36 | Botões ligados a endpoints existentes. U-B36 chama-se "Histórico" (não "Resolvidos"). |
| U-A05, U-B06 | Toast com "Anular" ao apagar tarefas, movimentos, cartões, notas pessoais e turnos. |
| U-A06, U-A19, U-B05, U-B24, U-A13, U-A16, U-A27, U-A35, U-A14, U-B07 | Toasts de sucesso e verificação do booleano antes de fechar diálogos. |
| U-A34, U-A17, U-B33, U-B42, U-B22, U-B23, U-A19, U-A35 | Confirmações onde faltavam. |
| U-A09, U-B26, U-A10, U-B46, U-B18, U-B31, U-B35, U-B37, U-A20, T-05 | Títulos, placeholders, datas e números pela língua da app. |

#### 11.1b Fase 2 backend (2026-11-23)

| Achados | O que foi feito |
|---|---|
| B-28 | `course-risk.overview` faz um único `groupBy` (por cadeira, presença e data) e reparte em memória. O cron "quase lá" só chama `overview` para utilizadores com componentes ou tarefas com peso num período ativo. |
| B-30 | 10 `@@index` redundantes retirados de `schema.prisma` (ver 11.6 para confirmar com `pg_stat_user_indexes` e para a migração). |
| B-32, S-33 | `GET /users` com `q`, `limit`, `cursor` e `paginated`. Sem estes parâmetros continua a devolver um array (máximo 1000, cabeçalho `X-Result-Truncated`). Com `cursor` ou `paginated=true` devolve `{ items, nextCursor }`. |
| B-33, S-17, B-46 | Heatmap, tempo por área, streak e `predictions/accuracy` agregam em SQL (`study-sessions.sql.ts`, `$queryRaw` parametrizado, fuso `APP_TIME_ZONE`). `heatmapCache` removido. `@Throttle` de 30 por minuto em `time-by-area` e `predictions/accuracy`. |
| B-34 | Previsão e plano de estudo somam o tempo das sessões em SQL. A previsão usa uma janela de 12 meses. O plano de estudo (`/study-plan/courses`) não tem janela, de propósito. |
| B-35 | `publish` com um só `findMany`; `linkLegacyItems` por lote. Sem flag (ver 11.6). |
| B-36, B-44 | `weightBudgets` e o import usam 3 `groupBy`; `updateEntry` e `removeEntry` validam com um só `findFirst`. |
| B-37, B-38 | `groupBy` único nas áreas ligadas à turma; `syncSameTeacher` numa `$transaction`. |
| B-39 | Janela do cron de lembretes reduzida de 72 h para 25 h e leitura paginada (até 10 páginas de 1000). Ver 11.2. |
| B-40, B-47 | `notifyUser` lê subscrições e `mutedPushKinds` numa só query; notas pessoais agrupadas por utilizador; faltas com um `groupBy` por página e janela de período. |
| B-42 | Lock por utilizador (`pg_advisory_xact_lock(hashtext(userId))`) numa transação à volta de validar o peso e inserir. Cobre `create`, `update` de peso, import, recorrências, `reorder`, prazos da turma e criação de componentes de nota. |
| B-43, B-45 | `userId` nos `where` de tarefas, subtarefas e componentes. B-45 já estava feito: o frontend só usa a rota paginada. |
| S-05 | `MAX_PROGRAMS_PER_USER = 20`, `MAX_PERIODS_PER_PROGRAM = 30`, e o import de programa da turma conta as Áreas privadas existentes mais as novas. |
| S-09 | Cache LRU de 60 s (máximo 1000 chaves, indexada por HMAC) para API keys, invalidada no revoke. `lastUsed` só de 5 em 5 minutos. Bloqueio com 429 após 20 falhas em 10 minutos por IP. |
| S-10 | Contador de tentativas por desafio 2FA: ao fim de 5 falhas o desafio morre e fica um `SecurityLog` (tipo `RATE_LIMIT_EXCEEDED`, caminho `/auth/2fa/login`, com IP e user-agent). |
| S-11 | `forgot-password` com cooldown de 1 minuto por email normalizado e todo o trabalho em background, com o mesmo tempo de resposta em todos os caminhos. |
| S-15, S-32 | `DateRangeQueryDto` com `@IsRealDateKey()` e teto de 400 dias em `/schedule`, `/schedule/attendance` e `/schedule/study-vs-class`. Datas inválidas dão 400, nunca 500. O corte em "hoje" vive só no service. |
| S-16 | `SessionCookieService` e `ProfileService` extraídos do `auth.controller` (de cerca de 1008 para cerca de 620 linhas). O controller já não injeta o Prisma. |
| S-19, S-20, S-22, S-23 | `@Max` com constantes nos DTOs numéricos; DTOs para `days`, `month`, `only`, `periodId`, `includeHidden`; `ParseUUIDPipe` nos `:id` dos controllers; `EMAIL_MAX_LENGTH` nos 3 DTOs de email. |
| S-21, S-24, S-25 | `provider` validado por `ParseEnumPipe`; `AccountStatusService.getMyStatus`; regras "não a ti próprio" movidas para os services e `CronSecretGuard` com `safeEqual`. |
| S-29, S-31 | Helper `singleFileUpload` e `UPLOADS_PER_MINUTE` em `common/upload-limits.ts`; literais de `perMinute` trocados por constantes nomeadas; `TASK_BULK_MAX = 200` nos 4 DTOs de bulk. |
| S-34 | Documentado (comentários em `banned-ips.service.ts`, `app.module.ts` e `email-verification.service.ts`): ban de IPs, throttler, cooldowns e agora cache de API keys e contador 2FA assumem uma só instância do Render. Se escalar: Redis para o throttler, pub/sub ou leitura da BD com cache curto para bans. |

#### 11.1c Fase 3 testes backend (2026-11-23)

Estado: S-04, S-18 e S-36 feitos. Só ficheiros `*.spec.ts` novos (Prisma em mock), mais uma correção de produção. `tsc --noEmit` limpo; `jest` completo: 244 suites, 2342 testes, todos passam.

| Achados | Specs novas |
|---|---|
| S-04 | `auth/services/totp.util.risk.spec.ts` (janela de mais ou menos 1 passo), `auth/oauth-merge.policy.risk.spec.ts` e `auth/services/oauth-identity.service.risk.spec.ts` (merge falha a fechar, sem `emailVerified` nunca funde), `auth/services/two-factor.service.risk.spec.ts` (reutilização de TOTP, recovery codes de uso único, contador S-10), `auth/services/api-key.service.risk.spec.ts` (scope ADMIN só para admins, revogar com `{id, userId}`, hash apenas). S-09 e S-11 já tinham cobertura. |
| S-18 | `grade-components/grade-components.edge.spec.ts` (BEST_OF, DROP_LOWEST, orçamento de pesos), `users/users.service.moderation.spec.ts` (suspender, banir, reativar; não a ti próprio), `calendar/calendar.service.refresh.spec.ts` (refresh 401, upsert, recriação), `calendar/schedule-sync.service.spec.ts`. |
| S-36 | `prediction.service.edge`, `work-shifts.service`, `commitments.service`, `banned-ips.service`, `tasks/weekly-review.service`, `wellbeing-insights.service`, `blood-donations.service`, `turma-announcements.service`, `turma-linked-areas.edge`, `task-types.service`, `priorities.service`, `agent/agent-config.service`, `area-interests.service`, `telemetry.service`. |
| Ownership das fases 1 e 2 | `tasks/tasks.bulk.ownership.spec.ts`, `notebook/notebook.search.ownership.spec.ts`, `study-sessions/study-sessions.sql.ownership.spec.ts`, `areas/areas.ownership.spec.ts`. Não existe endpoint de reorder em áreas nem no caderno, só em tarefas. |

**Bug de produção encontrado e corrigido:** `agent/agent-config.service.ts`, `find()` devolvia os arrays partilhados `DEFAULTS.blockedProcesses` e `blockedDomains`; mutar a resposta contaminava os defaults de todos os utilizadores seguintes. Agora copia os arrays. Teste de regressão: "defaults are not shared between calls".

**Comportamentos fixados em teste, sem alteração (decidir se são desejados):**
- Um 401 do Google no refresh vira 400 ("reconnect"), não 401.
- Moderação de utilizador inexistente rebenta com P2025 cru; depende do `PrismaExceptionFilter` para virar 404.
- `reactivateUser` não tem guarda "não a ti próprio".
- No `schedule-sync`, um update que recria o evento (404/410) conta como `updated`.
- `TurmaLinkedAreasService.link` aplica o limite de 20 antes do upsert, logo religar uma área já ligada com 20 ligações dá 400.
- A cache de `banned-ips` não tem expiração por tempo (só ban, unban e reload).
- `task-types` e `priorities` são catálogos de admin, sem `userId`.

**Não verificado:** cobertura percentual (não medida); nada testado contra BD real; specs com mocks de Prisma não apanham erros de SQL.

### 11.2 Corrigido só em parte, ou com limitação

- **B-39:** a exclusão das já enviadas em SQL não foi feita (a marca `SentReminder` é por tarefa e data, e o Prisma não a compara com a coluna da própria tarefa). Alternativa em SQL puro: `NOT EXISTS (SELECT 1 FROM "SentReminder" s WHERE s."taskId" = t.id AND s."taskDate" = t.date)`, uma vez para `date` e outra para `submissionDate`.
- **B-35:** `linkLegacyItems` repete a procura em itens sem origem (agora por lote em vez de por item). Fica completo com o campo `legacyLinkCheckedAt` (ver 11.6).
- **B-34:** a amostra de calibração e de treino da previsão passa a ser a dos últimos 12 meses.
- **S-09, S-10, S-11:** estado em memória do processo. Com mais de uma instância os limites multiplicam-se (ver S-34 e as opções persistentes em 11.6).
- **S-05:** `resolveActivePeriodId` (auto-criação do programa "General") não aplica o teto de programas.
- **PredictionService.modelCache** continua um `Map` sem limite (fora dos itens).

- **B-27:** não é uma transação única. Se só alguns creates falharem, as tarefas antigas são apagadas na mesma, como antes.
- **U-B36:** o separador devolve também as pendentes (marcadas como "Pendente").
- **U-B33:** resolvido na fase 4 (desbanir pede confirmação, ver 11.8).
- **Anular ao apagar:** tarefas voltam com checklist mas sem histórico nem anexos e com id novo. Contas, metas e investimentos de finanças ganharam Anular na fase 4 (11.8).
- **U-A19:** sem Anular em "desligar todas", só confirmação.
- **B-43:** `areas.service` `remove` e `update` ficam sem `userId` no `where` porque o admin gere Áreas oficiais (`ownerId` nulo). Subtask, `turma-*` e alguns outros mantêm a verificação de posse prévia.

### 11.3 Por fazer

- **Índices únicos parciais (B-23, B-31)**, o utilizador cria com `npx prisma migrate dev --create-only --name study_session_one_active` e `--name area_official_name_unique`, cola o SQL e aplica. Antes, confirmar que não há utilizadores com duas sessões ativas nem Áreas oficiais duplicadas.
  ```sql
  CREATE UNIQUE INDEX "study_session_one_active" ON "StudySession"("userId") WHERE "endedAt" IS NULL;
  CREATE UNIQUE INDEX "area_official_name_unique" ON "Area"(lower("name")) WHERE "ownerId" IS NULL;
  ```
- **Opcional (B-24):** `pg_trgm` com índices GIN em `title` e `textContent`.
- **Secção 2.2 itens 5 a 8:** testes de auth (S-04, S-18, S-36), pesquisa, filtros e mobile feitos na fase 4 (11.8); refatorações do frontend feitas na fase 5 (11.9).
- **Restantes de 2.2 itens 1 a 4:** F-16, EctsWorkloadCard e a unificação dos 4 barramentos antigos feitos na fase 5 (11.9). Os achados de backend B-28, B-33, B-34, B-36 a B-38, B-42, S-05, S-09 a S-11, S-15, S-17 foram tratados na fase 2 (11.1b).
- **Fase 3 (testes):** feita (ver 11.1c). Limitações de cobertura em 11.1c.
- **Não testado em execução na fase 2:** 2FA (`TWO_FACTOR_ENABLED` desligado), recorrência de API key com o agente Go, cron de lembretes e "quase lá", import de programa da turma e publicação de pacotes, B-42 em `update` e `reorder` em corrida (só `create` foi testado), e o SQL de `study-plan/courses` e da previsão contra dados antigos com janela. Teste de carga de `GET /users` paginado (a página `Users.tsx` usa a paginação desde a fase 5).
- **Não testado em execução (ver 11.4):** o `grantId` do `FriendProfile` ligado ao backend, revogar acesso a notas e a partilha de quiz (a conta não tem concessões), arrastar com o rato (a API de reorder foi testada, o gesto não), tabelas de TaskTypes em mobile, "descartar quiz" dentro de um exame em curso.
- **Aviso:** `eslint --fix` e `prettier` normalizaram fins de linha, o git vai avisar de LF/CRLF.

### 11.4 Teste em execução (2026-11-22)

Método: `preview_start` do backend e do frontend, browser embutido com a sessão da conta real. Dados de teste com prefixo "ZZ-teste", todos apagados no fim (tarefas, movimento, cartão, nota, turno, quiz, componente de nota, programa). Alguns dados de teste foram criados pela API ou pelos serviços da app em vez de cliques, porque o ecrã não oferece caminho curto; as validações de UI (diálogos, toasts, Anular) foram sempre pela interface.

| Superfície | Resultado |
|---|---|
| Modal com `isDirty` e Escape na pilha (criar tarefa, editar tarefa, editar movimento, importar cartões) | Testado, passou. Escape com alterações abre "Descartar alterações?", Escape no diálogo fecha só o diálogo, Escape sem alterações fecha direto. |
| Toast de sucesso ao criar tarefa, "Quiz renomeado" | Testado, passou. |
| Anular ao apagar (tarefa, movimento, cartão, nota pessoal, turno) | Testado, passou. A tarefa volta com id novo e estado preservado. Funciona também em mobile e no tema claro. |
| Apagar exceção de horário | Testado: pede confirmação e apaga, mas não oferece Anular (limitação, ver 11.2). |
| Confirmações (apagar quiz, desativar tipo de tarefa, banir IP, apagar turno e exceção) | Testado, passou (banir IP e desativar tipo só até ao diálogo e Cancelar). O botão "Ban" das linhas só preenche o campo, o ban real é "Ban IP" e pede confirmação. |
| Revogar acesso (notas e quiz) | Não testado: a conta não tem concessões. |
| Renomear quiz, editar título de subtarefa, editar etiqueta de entrada de componente, limpar humor | Testado, passou. |
| Separador Histórico em appeals | Testado, passou (mostra decididas e pendentes). |
| Arquivar e restaurar programa (programa de teste) | Testado, passou. O seletor mostra "(archived)" e restaurar volta ao normal. |
| Estado partilhado | Testado, passou. Concluir tarefa tira-a da lista "Due today" do Focus sem F5. Criar e apagar uma sessão de estudo mexe no cartão de streak e volta ao estado inicial. Nota: o Dashboard principal usa o contexto de tarefas da app, não o barramento, e só reflete mutações feitas dentro do próprio ecrã. |
| Concluir em massa com recorrência e dependente | Testado, passou. Cria a próxima ocorrência semanal e o dependente deixa de estar bloqueado. |
| Pesquisa do caderno na paleta Ctrl+K | Testado, passou. Resposta só com `preview` e contagens, sem URLs assinados, `q` com mais de 200 caracteres devolve 400. |
| Reorder | A API foi testada (`UPDATE` com `unnest` inverteu a ordem das tarefas de teste, id inexistente devolve 400). O gesto de arrastar não foi testado. |
| Língua | Testado em pt, ja e en: título da página e datas mudam (15/12/2026, 2026/12/15, 12/15/2026). |
| Register e ForgotPassword | Testado, abrem (chunks lazy ok). |
| Mobile (375 px) | Testado: modal de nova tarefa cabe (343 px), botões com 42 px, diálogo de confirmação e toast com Anular visíveis, sem scroll horizontal. |
| Tema claro | Testado: lista, diálogo de confirmação e toast legíveis. A pilha de `prefers-color-scheme` não altera a app, o tema vem das preferências de acessibilidade. |
| Console e logs | Backend sem erros e sem email nos logs (só `id` e `role`). A consola só tem erros de rede esperados (backend a arrancar e os pedidos inválidos de teste). |

**Corrigido nesta ronda:** os textos de confirmação de apagar tarefa, movimento, cartão, nota pessoal e turno diziam "não pode ser desfeito" mas agora há Anular. Passaram a dizer que se pode anular logo a seguir (5 chaves em 8 línguas). `check-i18n` 4800 chaves e 0 problemas, `tsc` limpo, vitest 953 testes. Jest do backend não foi repetido (sem alterações ao backend nesta ronda).

**Nada de código falhou** nos testes acima. Efeitos secundários de teste repostos: programa ativo e preferências de tema ficaram como antes.

### 11.5 Teste em execução da fase 2 (2026-11-23)

Método: backend e frontend locais com `preview_start`, browser embutido, conta real (o utilizador iniciou sessão; nenhuma credencial foi escrita por mim). Dados de teste com prefixo "ZZ-teste", apagados no fim (9 tarefas, todas com 200 no DELETE). Servidores parados.

Verificações automáticas: `tsc --noEmit` do backend limpo; jest do backend 217 suites e 1964 testes, todos a passar. O frontend não foi alterado nesta fase, por isso `tsc`, vitest e `check-i18n` não foram repetidos.

| Superfície | Resultado |
|---|---|
| `/schedule`, `/schedule/attendance`, `/schedule/study-vs-class` | 200 com datas reais. `from=lixo` e `2026-13-01` dão 400 (antes 500). Intervalo de mais de 400 dias dá 400. Parâmetro extra dá 400. |
| `/study-sessions/history?days=` | 14 dá 200; 0 e 1e9 dão 400. |
| SQL novo contra a BD real | Heatmap (42 células, 5849 min e 78 sessões), tempo por área (5850 min e 78 sessões, a diferença de 1 é arredondamento), streak, `predictions/accuracy`, `study-plan` e `study-plan/courses` devolvem 200 com a mesma forma de antes. |
| Export RGPD | 1.º pedido 200, seguintes 429. |
| `GET /users` | Array como antes; com `paginated=true&limit=2&q=a` devolve `{ items, nextCursor }`; `q` com 101 caracteres dá 400. `providers/xyz` dá 400. |
| `GET /areas?periodId=zz` | 400. `GET /tasks/not-a-uuid` e `GET /grade-components/weight-budgets?periodId=` inválido dão 400. |
| `GET /finance?month=2026-13` | 400; `month=2026-11` dá 200. |
| Pesquisa do caderno | 200, só resumo (`preview`, `photoCount`, `attachmentCount`). |
| B-42 em corrida | 6 criações simultâneas dão `sortOrder` 19 a 24, todos distintos. 3 criações simultâneas de 60% na mesma cadeira: uma passa, duas dão 400 "Only 40% is left". |
| `forgot-password` | Respostas 200 iguais e rápidas (1 a 7 ms) para o mesmo email e para variações de maiúsculas. |
| API key inválida | 401 (cerca de 186 ms, scrypt só no primeiro pedido). |
| Feed `?only=zzz` | 400. |
| Páginas Focus, Schedule, Weekly review, Money, Chance of passing, Areas | Abrem sem nenhum pedido ao backend com estado de erro. |
| Logs do backend | Sem erros. |

Nada de código falhou nos testes. Nota: `GET /users/me` devolve 400 porque `me` cai na rota `:id` (comportamento anterior, não alterado).

### 11.6 Migrações e SQL para o utilizador (nada foi escrito nem aplicado)

1. **B-30, `npx prisma migrate dev --name drop_redundant_indexes`.** O `schema.prisma` já não tem os 10 índices. Antes de aplicar, confirmar em produção que o `idx_scan` deles é cerca de 0:
   ```sql
   SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan;
   ```
   Índices retirados (modelo e coluna): `Task(userId)`, `StudySession(userId)`, `ClassOccurrence(userId)`, `WorkShift(userId)`, `Commitment(userId)`, `TurmaPack(turmaId)`, `TurmaLinkedArea(turmaId)`, `FinanceAccount(userId)`, `FinanceHolding(userId)`, `FinanceGoal(userId)`. Se a migração gerar `DROP INDEX` para outros, parar e verificar. O backend funciona com ou sem esta migração.
2. **B-35 (opcional), `--name pack_item_legacy_checked`.** Acrescentar `legacyLinkCheckedAt DateTime?` ao modelo `TaskPackItem` e depois usar o filtro `legacyLinkCheckedAt: null` em `linkLegacyItems`:
   ```sql
   ALTER TABLE "TaskPackItem" ADD COLUMN "legacyLinkCheckedAt" TIMESTAMP(3);
   ```
3. **B-23 e B-31, por criar** (secção 11.3): `--create-only --name study_session_one_active` e `--name area_official_name_unique`.
4. **Índices opcionais de apoio ao SQL novo:**
   ```sql
   CREATE INDEX "StudySession_userId_taskId_ended_idx" ON "StudySession"("userId", "taskId") WHERE "endedAt" IS NOT NULL;
   CREATE INDEX "Task_userId_completedAt_idx" ON "Task"("userId", "completedAt");
   ```
   Opcional para `GET /users?q=`: `User(createdAt)` e índices `pg_trgm` GIN em `name`, `email` e `friendCode`.
5. **S-10, S-11, S-34 (só se o Render passar a mais de uma instância).** Estado persistente em vez de memória:
   ```sql
   ALTER TYPE "SecurityEventType" ADD VALUE 'TWO_FACTOR_CHALLENGE_LOCKED';
   CREATE TABLE "EmailCooldown" ("email" text, "kind" text, "lastSentAt" timestamptz NOT NULL, PRIMARY KEY ("email","kind"));
   ```
   e um modelo `TwoFactorChallenge { jti String @id; userId String; attempts Int @default(0); expiresAt DateTime; @@index([expiresAt]) }` (`--name two_factor_attempts`). Alternativa: Redis (`SET key 1 NX PX 60000`) e pub/sub para invalidar a cache de API keys.

### 11.7 Notas para o frontend (tratadas na fase 5, ver 11.9)

- `forbidNonWhitelisted` faz parâmetros de query desconhecidos devolverem 400 em `/schedule*`, `/finance`, `/calendar/schedule/preview` e `/feed/:file`. Os clientes do frontend (`scheduleService`, `financeService`) só enviam `from`/`to` e `month`. Um assinante do feed `.ics` que acrescente um parâmetro como `?_=ts` passa a receber 400.
- `days` fora do intervalo ou não inteiro dá 400 (antes era cortado): history 1 a 90, daily-totals 1 a 365, study-plan 1 a 30.
- `frontend/src/api/userService.ts:406` tem `200` fixo (`BULK_TASK_BATCH_SIZE`), a juntar a `TASK_BULK_MAX` do backend.
- `Users.tsx` pode passar a usar `q` e `paginated` quando a lista admin crescer.
- Há 400 novo no `POST /programs` com 20 programas, `POST /periods` com 30 períodos e no import de programa da turma acima dos tetos: convém mostrar a mensagem do erro.

### 11.8 Fase 4: fricções de UX (secção 6), 2026-11-24

Tratados todos os U-A01 a U-A36, U-B01 a U-B46 e T-02 a T-04 que não estavam feitos. Os que ficaram só em parte estão na tabela "Parcial". Nada foi commitado, sem alterações de schema nem migrações.

Verificação: `tsc --noEmit` limpo no frontend e no backend; vitest 158 ficheiros e 1056 testes; jest 244 suites e 2371 testes; `check-i18n` 5052 chaves, 8 línguas, 0 problemas. O ESLint do frontend não corre (não existe `eslint.config.*`).

#### Corrigido

| Área | Achados | O que foi feito |
|---|---|---|
| Partilhado | U-B03 | `SearchField`, `useListSearch` e `lib/listFilter`; alvos de 44 px em ecrãs de toque em `Button`, `IconButton`, `ToolbarButton`, `ToggleChip`, `ActionButton`, `CopyButton` e aviso de cookies. |
| Tarefas | U-A04, U-A05, U-A07, U-A08, U-A11, U-A12, U-A13 | Subtarefas com botões e subir/descer; Anular ao concluir pelo modal ou `c` e ao apagar em massa; aviso quando o Calendar falha; pesquisa e filtros em `/tasks`; pré-visualização do import e CSV modelo; renomear e confirmar modelos; renomear anexos. |
| Packs e tipos | U-A14 a U-A17, U-B40, T-02 | Renomear pack, pesquisa e filtro por Área, ocultar em vez de lixo em tipos e prioridades, reordenar tipos, cartões em mobile. |
| Áreas, períodos, notas | U-A18, U-A19, U-A21 a U-A25 | Validação do nome, Anular em "desligar todas", rótulos e validação de datas, CSV e ordenação do boletim, erro com repetir na previsão, alvo guardado por Área. U-A20 e U-A36 já estavam feitos. |
| Notas, pad, caderno | U-A26 a U-A29, T-03 | Pesquisa, filtros, contador e exportação; lembrete passado bloqueado; copiar e descarregar pads, aviso de colagem cortada, pads recentes, `dvh`; erros da pesquisa e das listas visíveis. |
| Flashcards e quizzes | U-A31 a U-A35 | Pesquisa, ordenação, seleção múltipla, "Guardar e novo", exportar TSV, anular última classificação, pesquisa de quizzes, apagar uma tentativa, mensagens de erro do backend. |
| Finanças | U-B04 a U-B11, U-B46 | Sem valores velhos ao mudar de mês, Anular em contas, metas e investimentos, pesquisa e filtros, "Mês atual", estados de gravação, arrastar CSV. |
| Bem-estar | U-B12 a U-B20 | Mini-calendário de humor, rascunho por dia, edição por medicamento, edição de tomas e dádivas, exportar histórico, recarga falhada mantém os dados. |
| Horário | U-B21 a U-B25, U-B27, U-B28 | Criar, editar e apagar aulas, apagar por intervalo, editar exceções e Anular ao apagar, erros com repetir. |
| Agente, developer, segurança | U-B29 a U-B34 | Indicador por gravar, colar listas, renomear chaves, cartões em mobile, confirmar desbanir, pesquisa de IPs, atualizar e exportar logs. |
| Admin e feedback | U-B35 a U-B39 | Filtros, ordenação e paginação de utilizadores, botões desativados nos appeals, pesquisa no feedback, editar e apagar o próprio feedback, pesquisa de pads. |
| Social | U-B41 a U-B45 | Pesquisa e ordenação de amigos e notas, confirmações, "Todas" e "Nenhuma". |
| Transversal | U-B46, T-02, T-03, T-04 | Datas e números na língua da app, cores dos gráficos por tokens, `title` nos textos truncados, `useVisibleInterval`. |

Paleta de comandos: ações "Adicionar aula" (`/schedule?add=class`) e "Enviar feedback" (`/my-feedback?send=1`) e novas palavras-chave. Sem páginas novas, por isso a navegação não mudou. Uma entrada no changelog.

Endpoints novos (todos com `userId`): `PATCH /task-packs/:id`, `POST /schedule/class`, `PATCH /schedule/:id`, `DELETE /schedule/:id`, `PATCH /schedule-exceptions/:id`, `POST /flashcards/:id/restore`, `DELETE /quizzes/:id/attempts/:attemptId`, `PATCH /wellbeing/medications/intakes/:id`, `PATCH /wellbeing/blood-donations/:id`, `PATCH /auth/api-keys/:id`, `PATCH /tasks/:taskId/attachments/:attachmentId`, `DELETE /feedback/mine/:id`, `PATCH /feedback/mine/:id`.

#### Parcial ou por fazer

| Achado | Limitação |
|---|---|
| U-A05 | Anular em massa só até 50 tarefas; anexos, histórico e evento do Calendar não voltam. |
| U-A08, U-B08 | `/tasks` sem seleção múltipla nem exportação; movimentos sem ordenação nem seleção múltipla. |
| U-A12 | Modelos continuam só em localStorage (servidor precisa de schema). |
| U-A15 | Só se edita o nome do pack, não os itens. |
| U-A17 | Aviso de impacto sem contagem de tarefas (o backend não a devolve). |
| U-A22 | Boletim e Revisão ordenam e marcam arquivados, mas mantêm seletor próprio. |
| U-A30 | Sem Anular ao apagar entrada do caderno (precisa de soft-delete) e sem mover entre cadeiras. |
| U-A33 | Mostra a data de criação, não o último uso. |
| U-A35 | Apagar uma tentativa não recalcula as estatísticas por pergunta (`Quiz.stats` não guarda respostas por tentativa). |
| U-B06 | Anular conta não religa movimentos; o investimento perde o custo médio. |
| U-B17 | Ver tomas até 61 dias; apagar toma sem Anular. |
| U-B22 | "Mover para" tem 44 px de altura, não de largura. |
| U-B33 | Bans sem expiração (precisa de schema). |
| U-B34 | Ordenar e exportar só a página carregada; opções de purga iguais. |
| U-B35, U-B44 | Paginação de utilizadores no cliente; notas de amigos sem paginação. |
| U-B37 | Sem filtro por língua nem paginação. |
| U-B38 | Sem responder à resposta da equipa. |
| U-B39 | Fontes bloqueadas derivadas só dos pads recentes (falta endpoint de listagem). |
| U-B03, U-B25 | Alvos de toque tratados nos componentes partilhados e nos casos visíveis, não numa varredura exaustiva. |
| T-04 | `BreakBanner`, `StudySessionProvider`, `useHealthCheck`, `useNotebookEntries` e `tabPresence` mantêm `setInterval` (têm de correr com o separador escondido ou vivem fora de componentes). |

#### Teste no browser (2026-11-24)

Método: `preview_start` do backend e do frontend, browser embutido com a sessão da conta real (iniciada pelo utilizador; nenhuma credencial escrita por mim). Dados de teste com prefixo "ZZ-teste". No fim, uma verificação por API a tarefas, flashcards, notas, finanças, packs, aulas, exceções, feedback, quizzes, dádivas, humor e pads deu zero ocorrências de "ZZ-teste". Preferências de tema repostas. Servidores parados.

**Incidente:** um erro no meu script de teste editou e apagou um registo real de dádiva de sangue (2026-09-01, sangue total, "Hospital S. João", sem nota). O registo foi recriado de imediato com os mesmos dados, a partir da resposta original da API. Tem um id novo e uma data de criação nova.

| Superfície | Resultado |
|---|---|
| Páginas com sessão em desktop (cerca de 35 rotas e vistas) | Abrem, sem chaves de i18n por traduzir, sem erros de carregamento, sem scroll horizontal. Backend sem erros. |
| Pesquisa e estado sem resultados | Tarefas, flashcards, quizzes, notas, amigos, utilizadores, feedback, pads, áreas e finanças: passou. |
| Horário | Criar (com validação de início e fim), editar, apagar com Anular, apagar por intervalo, editar e apagar exceção com Anular: passou. |
| Finanças | Criar conta e meta, apagar com Anular: passou. |
| Flashcards | Guardar e novo, mudar de cadeira em massa, apagar em massa com Anular: passou. |
| Notas | Aviso de lembrete passado, pesquisa, filtro, apagar com Anular: passou. |
| Tarefas | Pesquisa, concluir com `c` e Anular, carregar e renomear anexo, apagar em massa com Anular: passou. |
| Bem-estar, packs, feedback | Criar, editar e apagar dádiva; rascunho de humor por dia; renomear e apagar pack; editar e apagar o próprio feedback: passou. |
| Paleta de comandos | "Adicionar aula" e "Enviar feedback" abrem o formulário. Entrada no changelog visível. |
| Mobile (375 px) | Sem scroll horizontal nas páginas percorridas; tabelas em cartões. Alvos pequenos nos componentes partilhados corrigidos (`SegmentedControl`, `TabBar`, ligações do seletor de período, entre outros). |
| Tema claro | Segurança, notas e Dashboard (gráficos): legíveis. |
| Erro (backend parado) | 13 páginas mostram erro. Faltava "Tentar de novo" no Social, no plano de estudo, nos compromissos e na análise do bem-estar: corrigido e verificado. Developer e Agente têm botão. |

Corrigido nesta ronda: alvos de toque acima, botão de repetir em quatro cartões, datas da confirmação de apagar aulas por intervalo na língua da app. Depois das correções: `tsc` do frontend limpo, `check-i18n` 5052 chaves e 0 problemas, vitest 1056 testes.

**Não verificado:** apagar uma tentativa de quiz (o quiz de teste não passou a validação do import; coberto por spec), renomear chave API (criar uma chave pede autorização), editar tomas (exige um medicamento), Anular de investimento (precisa de cotação real), arrastar um CSV para finanças, cancelar pedido de notas, reimportar `.ics` com aula manual, mobile e tema claro em todas as páginas (só amostra visual), navegação por teclado além de Escape, paleta e atalho `c`.

**Alvos de toque ainda abaixo de 44 px (no fim da fase 4):** migalhas de navegação, lista de cadeiras em Áreas e no caderno, e alguns botões de texto em Focus, Social e Horário. Tratados na fase 5 (11.9).

**Achado anterior a esta fase:** o carregamento de anexos `.txt` numa tarefa falha ("mime type application/octet-stream is not supported"), apesar de a mensagem de erro listar `.txt` como permitido.

### 11.9 Fase 5: arquitetura do frontend (secção 5), 2026-11-25

Tratados os achados F que faltavam, as notas 11.7 e os alvos de toque. Nada foi commitado, sem alterações de schema nem migrações. No backend esta fase só mudou `GET /users` (parâmetros novos de filtro e ordem) e comentários.

Verificação final: `tsc` limpo (frontend app e node, backend); vitest 191 ficheiros e 1355 testes (antes 1056); jest 245 suites e 2384 testes; `check-i18n` 5057 chaves, 8 línguas, 0 problemas; `vite build` sem erros (um aviso: `advancedChunks` está obsoleto, o substituto é `codeSplitting`).

#### Corrigido

| Achados | O que foi feito |
|---|---|
| F-16, F-47, F-32, F-51 | Cache própria com stale-while-revalidate (`api/queryCache.ts`, `catalogCache.ts`, `mutationInvalidation.ts`), sem TanStack Query. Tarefas, Áreas e metadados reutilizados entre páginas; qualquer escrita relevante invalida; limpa no login, logout, 401 e troca de conta; sincroniza entre separadores. |
| F-09, F-18 | Digest e cartão Hoje partilham os pedidos. As conquistas usam a última lista conhecida e só descarregam quando falta. |
| F-43 | Dicionário dividido no build em núcleo (bloqueia o primeiro render) e resto. `pt`: de 316 KB (95,6 gzip) bloqueantes para 29,7 KB (10,0 gzip). As rotas lazy esperam pelo resto; o `check-i18n` verifica a divisão. |
| Barramentos, F-12, EctsWorkload | `lib/bus.ts` substitui os 4 barramentos. `EctsWorkloadCard` e mais 7 cartões ligados a `lib/domainEvents`. |
| F-52 | Chaves de armazenamento classificadas; o logout e a entrada de outra conta limpam as caches. Texto por gravar do caderno e quiz a meio ficam no logout da mesma conta. |
| F-02, F-13, F-20, F-40, F-42 | Medicação recarrega só o necessário; insights seguem o humor; Horário sem remontagens nem pedidos repetidos. |
| F-14, F-23, F-29, F-54 | Um coordenador de atualização ao refocar (pedidos escalonados 150 ms) e um hook comum nos 4 hooks sociais. |
| F-15, F-21, F-22, F-50, F-55 | Separadores da turma ficam montados; polling pela visibilidade; notas do caderno 30 de cada vez; contexto nas Áreas. |
| F-19, F-27, F-28, F-30, F-33 | `useFetch`, `useActivePeriodResource`, `usePersistedState` (mesmas chaves e formatos), `useLoadAbortable`, factory nos hooks de turma. |
| F-24, F-25, F-26, F-31, F-37, F-41, F-49, F-56 | Catálogo e tarefas por período partilhados; a lista antiga fica visível (bloqueada) ao mudar de período; replanear aplica localmente; `useTasksPage` dividido; listas mostram 50 de cada vez; contexto de dados do Dashboard. |
| F-34, F-35, F-36, F-38, F-39 | Paleta, bibliotecas de quiz, Caderno, serviços da API (`tasksService`, `areasService`, `authService`, entre outros) e páginas grandes divididos sem mudar comportamento. |
| F-58, F-59 | Histórico de tarefa num serviço; `getHttpStatus` em vez de `axios.isAxiosError`. |
| 11.7 | `Users.tsx` pesquisa, filtra e pagina no servidor; o limite de programas mostra a mensagem do servidor; limite do lote testado contra o backend; parâmetros enviados confirmados. |
| Alvos de toque | Migalhas, listas de cadeiras, "Funciona com", botões de texto e ligações em Dashboard, Focus, Social, Horário, Perfil, Tarefas, Caderno, Bem-estar e admin. |

Uma revisão independente encontrou defeitos nas alterações desta fase; 6 foram corrigidos com testes: lista de tarefas que não recebia a revalidação em segundo plano; leitura posterior a uma escrita (ou a um logout) a juntar-se a um GET anterior; logout a apagar texto por gravar; cache de outra conta visível por um instante; "selecionar tudo" a apanhar linhas por mostrar; modal de replanear a reabrir ao mudar de período.

Defeitos anteriores encontrados no browser e corrigidos: Escape na paleta fechava também o formulário por baixo; `/tasks?new=1` e `/tasks?open=<id>` não faziam nada quando já se estava em `/tasks`.

#### Mudanças de comportamento

- O digest diário usa o período ativo escolhido na app.
- A pesquisa de utilizadores passa a distinguir acentos e a procurar a frase num só campo; a ordem por nome só abrange os utilizadores carregados (há aviso).
- Alterações feitas fora do browser (agente, representante de turma, admin) podem demorar até 1 minuto nas tarefas e 10 nas Áreas.
- As preferências já não gravam o valor por omissão ao montar.
- Ao voltar ao separador, o polling do caderno só corre logo se já passou um intervalo.

#### Parcial ou por fazer

| Achado | Limitação |
|---|---|
| F-48 | O cursor continua em série; um endpoint de contagens precisa de backend. |
| F-19 | Sem chave de cache opcional em `useLoadOnce`. |
| F-38 | `financeService` não foi separado (um só domínio). |
| F-40 | Resolvido com `useMemo`; atuação do React Compiler não medida. |
| F-52 | Modelos de tarefa, filtros guardados e opções de importação do horário ficam no logout e não estão separados por conta. |
| F-03, F-46, F-57, F-60, F-61 | Sem ação (não se aplica ou é intencional). |
| F-43 | Quando chega o resto do dicionário, efeitos que dependem de `t` correm mais uma vez. |
| Alvos de toque | Caixas de seleção das tarefas e ligações no meio de texto continuam pequenas. |
| Cache | Caso raro: uma escrita com mais de 10 s e uma revalidação iniciada e terminada durante ela pode repor o estado anterior. |

#### Teste no browser (2026-11-25)

Método: backend local e build de produção do frontend servido por `vite preview` na porta 5173 (para testar a divisão do dicionário), com a sessão da conta real iniciada pelo utilizador; nenhuma credencial escrita por mim. No fim: service worker e caches do browser removidos, servidores parados, configuração temporária retirada de `.claude/launch.json`.

Único registo criado: uma tarefa "ZZ-teste fase5 cache", criada, concluída, anulada e apagada pelo seu id. A língua foi mudada para pt e reposta em en; o período ativo foi mudado e reposto.

| Superfície | Resultado |
|---|---|
| Rotas em desktop e a 375 px (cerca de 40) | Abrem sem erros de consola, sem chaves por traduzir e sem scroll horizontal. Backend sem erros. |
| Cache | A paleta aberta duas vezes não repete tarefas nem Áreas; criar e apagar atualiza Tarefas, Dashboard e Focus. |
| Mudança de período | Lista antiga bloqueada com "Loading" até chegar a nova. |
| Horário, Social, Turma | Alternar Semana/Mês não pede tarefas; refocar o Social escalona os pedidos; voltar a um separador da turma não mostra esqueleto. |
| Utilizadores | Pesquisa com espera, estado sem resultados e limpeza: passou. |
| Língua | Mudança para pt e de volta a en: títulos traduzidos. |
| Alvos de toque | Zero abaixo de 44 px nas 7 páginas remedidas depois da última correção. |

**Não verificado:** logout e troca de conta; `?exam`, `?plan` e `?single`; listas com mais de 50 tarefas; replanear atrasadas; gravar no caderno; link partilhado, quiz em curso e conta bloqueada; "carregar mais" nos utilizadores (há menos de 20); tema claro; carregamento do dicionário sem rede; PWA instalada; as 6 correções da revisão só têm testes automáticos.

### 11.10 Fase 6: parciais, auditoria de segurança e CI (2026-11-28)

Sem commits, sem alterações de schema nem migrações novas.

#### Corrigido

| Achados | O que foi feito |
|---|---|
| B-27 | Import de pacote em modo substituir é tudo ou nada, numa transação com lock por utilizador. Anexos só saem do storage depois do commit. |
| B-39 | Lembretes: o SQL devolve só ids pendentes (`NOT EXISTS` em `SentReminder`). |
| U-A17 | As listagens admin de tipos de tarefa devolvem `taskCount` (o frontend ainda não o mostra). |
| Cache de previsão | LRU com teto de 500 utilizadores. |
| F-52 | Modelos, filtros guardados, opções de importação e melhor streak guardados por conta. |
| Vite | `advancedChunks` passou a `codeSplitting`, com o mesmo resultado de chunks. |
| Alvos de toque | Caixas de seleção de tarefas, rótulos com checkbox e radio, "Mover para". |
| Segurança, média | Cache de API keys indexada por HKDF com salt por processo (a raw key não fica em memória); entradas expiradas removidas em cada escrita e por temporizador. |
| Segurança, média | O log de erros do Prisma deixou de copiar argumentos da query. |
| Segurança, baixa | Datas impossíveis dão 400 (21 campos), `userId` no update de tomas, texto só com espaços rejeitado, throttle nas escritas de aulas. |
| Segurança, frontend | Área de transferência do quadro e nota do Focus limpas na troca de conta; TSV de flashcards neutraliza fórmulas. |

#### Verificações (CI reproduzido localmente)

| Check | Backend | Frontend |
|---|---|---|
| ESLint | limpo | sem erros (avisos em dois ficheiros de teste) |
| `tsc` | limpo | limpo |
| Testes | jest 247 suites, 2407 | vitest 192 ficheiros, 1362 |
| Build | ok | ok |
| `npm audit --audit-level=critical` | 0 críticas (4 altas, 25 moderadas) | 0 críticas (6 moderadas) |
| i18n | n/a | 5057 chaves, 0 problemas |
| Prettier (`continue-on-error` no CI) | falha só por CRLF local | falha: sem configuração no frontend, já falhava antes |

Os checks `Backend: Quality & Checks` e `CodeQL` do PR 233 mostram FAILURE porque correm sobre o último push. Só mudam depois de commit e push.

#### Parcial, por fazer ou não verificado

- F-19, F-38 e F-48 sem ação: sem consumidor real, um só domínio, e os consumidores precisam da lista inteira.
- Chaves `pm-quiz-*`, `pm-grade-targets` e `pm-area-order` continuam sem separação por conta.
- Literais `perMinute(N)` em alguns controllers fora do diff.
- Não verificado: SQL do B-39 contra a base de dados real (o único disparo envia notificações reais); alerta do CodeQL; validação de uma API key no browser (não se criaram chaves).
- Índices únicos parciais e restantes migrações: ver 11.3 e 11.6.

#### E2e no browser (com sessão)

- Rotas com sessão em desktop e 23 delas em mobile: sem scroll horizontal e sem erros de consola depois das correções. Tema claro visto por amostra (tarefas e novidades, em mobile). As rotas de administração não foram abertas (os caminhos testados deram "Page not found").
- B-27 na base de dados real, com área, tarefas e pacote `ZZ-teste`: import em substituição com um item inválido não alterou nada; o válido substituiu 2 tarefas. Dados de teste apagados.
- Datas impossíveis: `/schedule` e `/finance/analytics` devolvem 400.
- F-52: o melhor streak está guardado por conta.
- Corrigido durante o e2e: keys duplicadas em `/changelog` (havia datas repetidas) e o select de área das tarefas, que tinha 32px em ecrã tátil (agora 44px, também na vista Board).
- Depois destas correções: `tsc`, lint e vitest (1362) do frontend passam.
