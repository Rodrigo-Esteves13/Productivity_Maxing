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
	"strings"
	"sync"
	"syscall"
	"time"

	"pmaxing-agent/internal/apiclient"
	"pmaxing-agent/internal/blocker"
	"pmaxing-agent/internal/config"
	"pmaxing-agent/internal/rules"
	"pmaxing-agent/internal/singleinstance"
	"pmaxing-agent/internal/tray"
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
	warnIfInsecureBaseURL(cfg.API.BaseURL)

	// Tem de ser adquirido antes de qualquer hosts.New()/hosts.Apply() -
	// ver internal/singleinstance para a race concreta que isto evita.
	releaseInstance, alreadyRunning, err := singleinstance.Acquire()
	if err != nil {
		log.Printf("warning: could not check for another running instance: %v (continuing anyway)", err)
	}
	if alreadyRunning {
		fatalVisible("another instance of pmaxing-agent is already running - check the tray icon or Task Manager")
	}
	defer releaseInstance()

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

	// tray.Run blocks (on Windows, it owns the OS message loop; see
	// internal/tray/tray_windows.go) until Exit is chosen from the tray
	// menu or agent.run(ctx) returns on its own (Ctrl+C, SIGTERM, a
	// Windows logoff) and calls tray.Quit() itself. Either way, OnExit
	// below always runs exactly once before the process exits - this is
	// the same hosts.Remove() cleanup that used to run unconditionally
	// at the end of main() before the tray existed.
	tray.Run(tray.Config{
		LogPath:   agentLogPath(),
		GetStatus: agent.trayStatus,
		OnReady:   func() { agent.run(ctx) },
		OnExit: func() {
			log.Println("shutting down - removing domain block from hosts file...")
			if err := hosts.Remove(); err != nil {
				log.Printf("warning: could not clean up hosts file on exit: %v", err)
			}
			log.Println("agent stopped.")
		},
	})
}

// agentLogDir devolve %AppData%\PMaxingAgent (ou o equivalente do SO),
// criando o diretório se necessário. Partilhado por setupLogging (que
// escreve agent.log lá dentro) e por agentLogPath (que dá o mesmo
// caminho ao tray para o "Open logs"), para as duas partes nunca poderem
// divergir sobre onde o ficheiro vive.
func agentLogDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	logDir := filepath.Join(dir, "PMaxingAgent")
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return "", err
	}
	return logDir, nil
}

// agentLogPath devolve o caminho completo para agent.log, usado pelo
// "Open logs" do tray. Nota: em -debug este ficheiro não recebe logs
// (vão para a consola, ver setupLogging) - pode não existir ainda ou
// estar desatualizado; o tray trata esse caso (ver openLogs em
// internal/tray/tray_windows.go).
func agentLogPath() string {
	dir, err := agentLogDir()
	if err != nil {
		return "agent.log"
	}
	return filepath.Join(dir, "agent.log")
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

	logDir, err := agentLogDir()
	if err != nil {
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

// warnIfInsecureBaseURL avisa (sem bloquear o arranque - localhost em
// desenvolvimento é um caso legítimo) se api.baseUrl não for https://.
// Sem TLS, a x-api-key vai em claro em cada pedido, e a resposta de
// GET /agent/config (domínios e nomes de processo que o agente aplica
// sem mais validação além da adicionada em internal/blocker) pode ser
// alterada por qualquer atacante na rede - deixa de ser só "fricção
// contra ti próprio" (ver README) e passa a ser um vetor de ataque real.
func warnIfInsecureBaseURL(baseURL string) {
	if strings.HasPrefix(baseURL, "https://") {
		return
	}
	if strings.HasPrefix(baseURL, "http://localhost") || strings.HasPrefix(baseURL, "http://127.0.0.1") {
		return
	}
	log.Printf("warning: api.baseUrl (%s) is not https:// - the API key and every /agent/config response travel unencrypted, and are not protected from tampering by a network attacker", baseURL)
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

	// mu guards every field below it. Before the tray existed, these
	// were only ever touched by run()/tick() on a single goroutine; now
	// trayStatus() also reads them, from the tray's own goroutine (see
	// internal/tray/tray_windows.go), so they need a lock.
	mu                sync.RWMutex
	lastRemoteConfig  *apiclient.AgentConfig
	lastDecision      rules.Decision
	lastPollAt        time.Time
	warnedNoElevation bool
}

// trayStatus builds the read-only snapshot the tray icon shows (tooltip
// text and the "View status" dialog). Safe to call concurrently with
// run()/tick() from another goroutine.
func (a *agentState) trayStatus() tray.Status {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return tray.Status{
		Configured: a.lastRemoteConfig != nil && a.lastRemoteConfig.IsConfigured,
		Blocking:   a.lastDecision.ShouldBlock,
		LastReason: a.lastDecision.Reason,
		LastPollAt: a.lastPollAt,
	}
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
			a.mu.RLock()
			remote := a.lastRemoteConfig
			a.mu.RUnlock()
			if remote != nil {
				want := time.Duration(remote.PollIntervalSeconds) * time.Second
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

	a.mu.Lock()
	a.lastPollAt = time.Now()
	previousRemote := a.lastRemoteConfig
	a.mu.Unlock()

	remote, err := a.client.FetchAgentConfig(ctx)
	if err != nil {
		log.Printf("error fetching remote configuration: %v", err)
		if previousRemote == nil {
			log.Println("no known configuration yet - waiting for next cycle")
			return
		}
		remote = previousRemote
		log.Printf("using last known remote configuration (failMode=%s)", remote.Blocking.FailMode)
	} else {
		a.mu.Lock()
		a.lastRemoteConfig = remote
		a.mu.Unlock()
	}

	if !remote.IsConfigured {
		log.Println("no configuration saved yet on the /agent page - nothing to do")
		return
	}

	a.mu.RLock()
	previousDecision := a.lastDecision
	a.mu.RUnlock()

	decision, err := a.decide(ctx, remote.TriggerRules)
	if err != nil {
		log.Printf("error fetching tasks: %v", err)
		switch remote.Blocking.FailMode {
		case apiclient.FailOpen:
			decision = rules.Decision{ShouldBlock: false, Reason: "tasks API unreachable, failMode=OPEN"}
			a.mu.Lock()
			a.lastDecision = decision
			a.mu.Unlock()
		default: // FailClosed
			// Bug real que já aconteceu aqui: gravar a versão já anotada
			// de volta em a.lastDecision fazia o sufixo "(kept: ...)"
			// acumular-se sem limite a cada ciclo em que a API
			// continuasse em baixo (um Reason com centenas de cópias do
			// mesmo sufixo repetido, ver histórico). buildKeptDecision
			// parte sempre de previousDecision (lida sob lock acima,
			// antes desta chamada) - a.lastDecision NUNCA é reatribuído
			// nesta branch de propósito, por isso o sufixo é sempre
			// acrescentado à última razão "limpa" conhecida, nunca à
			// versão já anotada do ciclo anterior.
			decision = buildKeptDecision(previousDecision)
		}
	} else {
		a.mu.Lock()
		a.lastDecision = decision
		a.mu.Unlock()
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
