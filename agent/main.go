// pmaxing-agent (v2) - agente local que bloqueia apps e sites com base nas
// tasks pendentes na app Productivity Maxing. Desde a Fase 5.1, as trigger
// rules e as listas de bloqueio já não vivem num ficheiro local - são
// geridas na página /agent do site e o agente vai buscá-las a
// GET /agent/config em cada ciclo de polling.
//
// A API key para autenticar chega por uma de três fontes, por ordem de
// prioridade (ver internal/config): 1) anexada ao fim do próprio .exe
// pelo botão de download em /agent (self-extracting, zero setup);
// 2) PMAXING_API_KEY no ambiente via "-set-key"; 3) config.json manual.
//
// O binário de distribuição é compilado com -ldflags="-H=windowsgui" (ver
// README), o que significa que corre SEM janela de consola quando é
// aberto com duplo-clique - pensado para correr em background. Os logs
// vão para %AppData%\PMaxingAgent\agent.log nesse modo. Usa -debug para
// forçar uma consola visível com logs em tempo real (útil para testar).
//
// O manifest embutido (ver resources/app.manifest) pede elevação de
// administrador automaticamente ao arrancar - não precisas de "Executar
// como administrador" à mão.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"pmaxing-agent/internal/apiclient"
	"pmaxing-agent/internal/blocker"
	"pmaxing-agent/internal/config"
	"pmaxing-agent/internal/rules"
	"pmaxing-agent/internal/winconsole"
)

func main() {
	configPath := flag.String("config", "config.json", "path to the local config file (only used if PMAXING_API_KEY is not set)")
	setKey := flag.String("set-key", "", "persist PMAXING_API_KEY permanently (setx) and exit - no config.json needed after this")
	debug := flag.Bool("debug", false, "force a visible console with live logs, instead of running in the background with file logs")
	flag.Parse()

	if *setKey != "" {
		cmd := exec.Command("setx", "PMAXING_API_KEY", *setKey)
		if err := cmd.Run(); err != nil {
			log.Fatalf("error saving environment variable: %v", err)
		}
		log.Println("API key saved to PMAXING_API_KEY. Close and reopen the terminal, then just run \"pmaxing-agent.exe\" (without -set-key).")
		return
	}

	closeLog := setupLogging(*debug)
	defer closeLog()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fatalVisible("error loading configuration: %v", err)
	}

	client := apiclient.New(cfg.API)
	hosts := blocker.New()
	procs := blocker.NewProcessBlocker()

	// Ctrl+C / kill do processo: removemos o bloqueio de domínios antes
	// de sair, para nunca deixar o hosts file bloqueado se o agente for
	// fechado de propósito.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Printf("pmaxing-agent starting up - fetching configuration from %s/agent/config", cfg.API.BaseURL)

	agent := &agentState{
		cfg:          cfg,
		client:       client,
		hosts:        hosts,
		procs:        procs,
		pollInterval: cfg.API.BootstrapPollInterval(),
	}
	agent.run(ctx)

	log.Println("shutting down - removing domain block from hosts file...")
	if err := hosts.Remove(); err != nil {
		log.Printf("warning: could not clean up hosts file on exit: %v", err)
	}
	log.Println("agent stopped.")
}

// setupLogging decide para onde os logs vão. Em -debug, aloca uma
// consola nova e mantém os logs lá (tempo real, como antes). Caso
// contrário, redireciona para um ficheiro em %AppData%\PMaxingAgent -
// necessário porque o binário "windowsgui" não tem consola nenhuma para
// onde escrever quando aberto com duplo-clique. Devolve uma função de
// cleanup para fechar o ficheiro de log no fim.
func setupLogging(debug bool) (closeLog func()) {
	if debug {
		winconsole.AllocDebugConsole()
		return func() {}
	}

	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	logDir := filepath.Join(dir, "PMaxingAgent")
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		// Sem consola e sem conseguir escrever o log - não há onde
		// avisar o utilizador. Segue em frente na mesma (os logs vão
		// simplesmente perder-se), o agente continua funcional.
		return func() {}
	}

	logPath := filepath.Join(logDir, "agent.log")
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return func() {}
	}
	log.SetOutput(f)
	return func() { f.Close() }
}

// fatalVisible mostra um erro fatal de arranque de forma garantidamente
// visível ao utilizador, independentemente de o processo ter sido
// lançado com duplo-clique (sem consola) ou a partir de um terminal já
// aberto (com consola herdada). Isto evita o pior cenário: o agente
// falhar silenciosamente logo no primeiro arranque, sem o utilizador
// perceber porquê (ex: ainda não gerou/gravou a API key).
func fatalVisible(format string, args ...any) {
	winconsole.AllocDebugConsole()
	msg := fmt.Sprintf(format, args...)
	fmt.Println("ERROR:", msg)
	fmt.Println()
	fmt.Println("Generate an API key and set up the agent on the /agent page of the site.")
	fmt.Println("Press Enter to exit.")
	bufio.NewReader(os.Stdin).ReadString('\n')
	os.Exit(1)
}

// agentState junta tudo o que o loop principal precisa de manter entre
// ciclos: a última configuração remota conhecida (para sobreviver a
// falhas de rede pontuais) e a última decisão de bloqueio tomada.
type agentState struct {
	cfg    *config.Config
	client *apiclient.Client
	hosts  *blocker.HostsBlocker
	procs  *blocker.ProcessBlocker

	pollInterval time.Duration

	lastRemoteConfig  *apiclient.AgentConfig
	lastDecision      rules.Decision
	warnedNoElevation bool
}

func (a *agentState) run(ctx context.Context) {
	ticker := time.NewTicker(a.pollInterval)
	defer ticker.Stop()

	a.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.tick(ctx)
			// A configuração pode ter mudado o pollIntervalSeconds na
			// página /agent - ajustamos o ticker para o próximo ciclo
			// já respeitar isso, sem precisares de reiniciar o agente.
			if a.lastRemoteConfig != nil {
				want := time.Duration(a.lastRemoteConfig.PollIntervalSeconds) * time.Second
				if want > 0 && want != a.pollInterval {
					log.Printf("polling interval updated: %s -> %s", a.pollInterval, want)
					a.pollInterval = want
					ticker.Reset(want)
				}
			}
		}
	}
}

func (a *agentState) tick(parentCtx context.Context) {
	ctx, cancel := context.WithTimeout(parentCtx, a.cfg.API.RequestTimeout()+5*time.Second)
	defer cancel()

	remote, err := a.client.FetchAgentConfig(ctx)
	if err != nil {
		log.Printf("error fetching remote configuration: %v", err)
		if a.lastRemoteConfig == nil {
			log.Println("no known configuration yet - waiting for next cycle")
			return
		}
		remote = a.lastRemoteConfig
		log.Printf("using last known remote configuration (failMode=%s)", remote.Blocking.FailMode)
	} else {
		a.lastRemoteConfig = remote
	}

	if !remote.IsConfigured {
		log.Println("no configuration saved yet on the /agent page - nothing to do")
		return
	}

	decision, err := a.decide(ctx, remote.TriggerRules)
	if err != nil {
		log.Printf("error fetching tasks: %v", err)
		switch remote.Blocking.FailMode {
		case apiclient.FailOpen:
			decision = rules.Decision{ShouldBlock: false, Reason: "tasks API unreachable, failMode=OPEN"}
			a.lastDecision = decision
		default: // FailClosed
			// Bug real que já aconteceu aqui: gravar a versão já anotada
			// de volta em a.lastDecision fazia o sufixo "(kept: ...)"
			// acumular-se sem limite a cada ciclo em que a API
			// continuasse em baixo (um Reason com centenas de cópias do
			// mesmo sufixo repetido, ver histórico). buildKeptDecision
			// parte sempre de a.lastDecision, que esta branch nunca
			// reatribui - por isso o sufixo é sempre acrescentado à
			// última razão "limpa" conhecida, nunca à versão já anotada
			// do ciclo anterior.
			decision = buildKeptDecision(a.lastDecision)
		}
	} else {
		a.lastDecision = decision
	}

	log.Printf("decision: block=%v (%s)", decision.ShouldBlock, decision.Reason)
	a.applyDecision(remote.Blocking, decision)
}

// buildKeptDecision constrói a Decision usada quando a API de tasks está
// inacessível e failMode=CLOSED (mantém o último estado de bloqueio
// conhecido, em vez de desbloquear às cegas). `last` deve ser sempre a
// última Decision genuína (de uma chamada a decide() que teve sucesso) -
// nunca uma já anotada por uma chamada anterior a esta função, ou o
// sufixo "(kept: ...)" acumula-se sem limite a cada ciclo (ver comentário
// em tick()).
func buildKeptDecision(last rules.Decision) rules.Decision {
	base := last.Reason
	if base == "" {
		base = "no previous decision known yet"
	}
	return rules.Decision{
		ShouldBlock: last.ShouldBlock,
		Reason:      base + " (kept: API unreachable, failMode=CLOSED)",
	}
}

func (a *agentState) decide(ctx context.Context, triggerRules apiclient.TriggerRules) (rules.Decision, error) {
	today, err := a.client.TasksToday(ctx)
	if err != nil {
		return rules.Decision{}, err
	}
	overdue, err := a.client.TasksOverdueCheckins(ctx)
	if err != nil {
		return rules.Decision{}, err
	}

	snap := rules.Snapshot{Today: today, OverdueCheckins: overdue}

	if rules.NeedsAllTasks(triggerRules) {
		all, err := a.client.TasksAll(ctx)
		if err != nil {
			return rules.Decision{}, err
		}
		snap.All = all
	}

	return rules.Evaluate(triggerRules, snap), nil
}

func (a *agentState) applyDecision(blocking apiclient.BlockingConfig, decision rules.Decision) {
	if len(blocking.Domains) > 0 {
		if !blocker.IsElevated() {
			if !a.warnedNoElevation {
				log.Println("warning: domains are configured but the agent is not running as administrator - site blocking disabled until you restart as admin")
				a.warnedNoElevation = true
			}
		} else {
			a.warnedNoElevation = false
			if decision.ShouldBlock {
				if err := a.hosts.Apply(blocking.Domains); err != nil {
					log.Printf("error applying domain block: %v", err)
				} else {
					log.Printf("domains blocked: %v", blocking.Domains)
				}
			} else if err := a.hosts.Remove(); err != nil {
				log.Printf("error removing domain block: %v", err)
			}
		}
	} else if err := a.hosts.Remove(); err != nil {
		log.Printf("error clearing domain block: %v", err)
	}

	if decision.ShouldBlock && len(blocking.Processes) > 0 {
		killed, err := a.procs.Enforce(blocking.Processes)
		if err != nil {
			log.Printf("error applying process block: %v", err)
		} else if len(killed) > 0 {
			log.Printf("processes terminated: %v", killed)
		}
	}
}
