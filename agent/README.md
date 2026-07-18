# pmaxing-agent (v2)

Agente local que bloqueia apps e sites com base nas tasks pendentes na
[Productivity Maxing](https://pmaxing.pt). Zero dependências externas —
só standard library do Go.

## Como funciona

A configuração vive toda na página **`/agent`** do site — não há nada
para editares à mão numa máquina Windows. A única coisa que o agente
precisa localmente é a tua API key.

A cada ciclo de polling, o agente:

1. Chama `GET /agent/config` (autenticado com `x-api-key`) para saber as
   regras e listas de bloqueio atuais — o que editares na página `/agent`
   fica ativo no próximo ciclo, sem reiniciares nada.
2. Chama `GET /tasks/today` e `GET /tasks/overdue-checkins` sempre; chama
   também `GET /tasks` (histórico completo) só se alguma regra ativa
   precisar mesmo disso (`hasOverdueTasks` ou o threshold de progresso).
3. Avalia as regras contra essas tasks para decidir se o bloqueio deve
   estar ativo. "Prazo passado" é sempre comparação de timestamp exato
   (sem noção de "dia de calendário") — uma task com deadline daqui a
   1 minuto só conta como overdue depois desse minuto passar, nunca antes
   nem só "amanhã".
4. Se sim: redireciona os domínios configurados para `127.0.0.1` no hosts
   file, e mata (via `taskkill`) qualquer processo configurado.
5. Se não: remove o bloco de domínios do hosts file e deixa de matar
   processos.

Se a API ficar inacessível a meio, o agente usa a última configuração e
decisão conhecidas, respeitando o `failMode` escolhido na página `/agent`.

**Importante sobre o hosts file:** isto é fricção deliberada contra ti
próprio, não uma barreira de segurança adversarial. Um browser com
DNS-over-HTTPS ativo pode ignorá-lo.

## Setup (sem ficheiro nenhum)

```
pmaxing-agent.exe -set-key A_TUA_KEY_AQUI
```

Isto grava `PMAXING_API_KEY` como variável de ambiente permanente
(`setx`) e sai. Fecha e reabre o terminal, e depois corre só:

```
pmaxing-agent.exe
```

como Administrador (precisa disso para editar o hosts file). Gera a tua
key na página `/agent` do site.

### Alternativa: ficheiro local

Se preferires não usar variável de ambiente, copia
`config.example.json` para `config.json`, preenche `apiKey`, e corre com
`-config config.json`. O agente tenta sempre `PMAXING_API_KEY` primeiro;
só lê o ficheiro se essa variável não existir.

## Build

```bash
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o pmaxing-agent.exe .
```

Requer Go 1.22+ só na máquina de build — o `.exe` final é estático, não
precisa de Go instalado em quem o corre.

## Arrancar automaticamente com o Windows (opcional)

Task Scheduler → Create Task → Trigger: "At log on" → Action: iniciar
`pmaxing-agent.exe` → ✅ "Run with highest privileges" (evita o prompt de
UAC repetido).

## Backend (Fase 5.1)

Este agente espera um endpoint `GET /agent/config` no backend, devolvendo:

```json
{
  "triggerMode": "ANY",
  "hasOverdueTasks": true,
  "hasOverdueCheckins": false,
  "minDifficultyToday": "HARD",
  "anyTaskToday": false,
  "minProgressStatus": "BEHIND",
  "blockedProcesses": ["steam.exe"],
  "blockedDomains": ["youtube.com"],
  "failMode": "CLOSED",
  "pollIntervalSeconds": 60,
  "isConfigured": true
}
```

Ver `prisma/schema.prisma` (modelo `AgentConfig`) e `backend/src/agent/`
no repositório principal.

## Roadmap

- DNS sinkhole local como alternativa mais robusta ao hosts file.
- Manifest embutido no `.exe` para elevação automática ao arrancar.
