//go:build windows

package blocker

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// protectedProcesses nunca são terminados, seja qual for o conteúdo de
// blockedProcesses em GET /agent/config. Isto é uma rede de segurança
// contra uma resposta maliciosa ou corrompida da API (ou de um
// man-in-the-middle numa baseUrl http:// não cifrada), não contra o
// próprio utilizador - matar qualquer um destes processos do Windows
// causa, no mínimo, perda da sessão gráfica (explorer.exe/dwm.exe) e, no
// pior caso, um crash do sistema (lsass.exe/csrss.exe/wininit.exe/
// winlogon.exe/services.exe/smss.exe), muito acima do que "bloquear uma
// app distrativa" alguma vez precisa de fazer.
var protectedProcesses = map[string]bool{
	"system":       true,
	"smss.exe":     true,
	"csrss.exe":    true,
	"wininit.exe":  true,
	"winlogon.exe": true,
	"services.exe": true,
	"lsass.exe":    true,
	"svchost.exe":  true,
	"explorer.exe": true,
	"dwm.exe":      true,
	"userinit.exe": true,
	"taskmgr.exe":  true,
}

// selfProcessName devolve o nome do próprio executável do agente (ex:
// "pmaxing-agent.exe"), lido em runtime em vez de hardcoded - assim
// continua a proteger-se a si próprio mesmo que o .exe seja distribuído
// com outro nome de ficheiro. Se os.Executable() falhar (muito raro),
// devolve "" e o filtro correspondente em Enforce simplesmente não
// encontra nenhum match, sem quebrar o resto do bloqueio.
func selfProcessName() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return strings.ToLower(filepath.Base(exe))
}

// isWildcard diz se `target` usa a sintaxe de wildcard do taskkill
// (`*`/`?` em /IM). Nunca queremos agir sobre um wildcard vindo da API
// remota: "*" mataria literalmente todos os processos do sistema, e
// mesmo um padrão mais restrito como "chrome*" tem um raio de ação que
// ninguém validou explicitamente na página /agent (que só lista nomes
// exatos, ver blockedProcesses no README) - só nomes de executável
// exatos são um alvo válido.
func isWildcard(target string) bool {
	return strings.ContainsAny(target, "*?")
}

// ProcessBlocker mata repetidamente os processos cujo nome de executável
// esteja na lista configurada. Usamos os binários nativos do Windows
// (tasklist/taskkill) via os/exec em vez de uma dependência tipo
// golang.org/x/sys/windows - fica com zero módulos externos no go.mod,
// ao custo de um processo extra por verificação. Como o polling é a cada
// dezenas de segundos (não milissegundos), este custo é irrelevante.
type ProcessBlocker struct{}

// NewProcessBlocker cria um ProcessBlocker para Windows.
func NewProcessBlocker() *ProcessBlocker {
	return &ProcessBlocker{}
}

// hideWindow evita que uma janela de consola preta apareça sempre que o
// agente corre tasklist/taskkill em segundo plano.
var hideWindow = &syscall.SysProcAttr{HideWindow: true}

// Enforce percorre a lista de processos configurados e mata (à força,
// /F) qualquer instância que esteja a correr. Devolve os nomes que
// realmente foram terminados neste ciclo (para logging).
func (p *ProcessBlocker) Enforce(processNames []string) ([]string, error) {
	running, err := p.runningProcessNames()
	if err != nil {
		return nil, err
	}

	self := selfProcessName()

	var killed []string
	for _, target := range processNames {
		target = strings.TrimSpace(target)
		if target == "" {
			continue
		}
		if isWildcard(target) {
			log.Printf("blocker: refusing to act on wildcard process pattern from remote config: %q", target)
			continue
		}
		lower := strings.ToLower(target)
		if protectedProcesses[lower] {
			log.Printf("blocker: refusing to terminate protected system process: %q", target)
			continue
		}
		if self != "" && lower == self {
			log.Printf("blocker: refusing to terminate the agent's own process: %q", target)
			continue
		}
		if !containsFold(running, target) {
			continue
		}
		cmd := exec.Command("taskkill", "/IM", target, "/F", "/T")
		cmd.SysProcAttr = hideWindow
		// Ignoramos o erro aqui de propósito: taskkill devolve exit code
		// != 0 se o processo já tiver morrido entre o tasklist e agora
		// (condição de corrida benigna), o que não é um erro real do
		// agente.
		_ = cmd.Run()
		killed = append(killed, target)
	}
	return killed, nil
}

// runningProcessNames corre "tasklist" e devolve a lista de nomes de
// processos atualmente em execução.
func (p *ProcessBlocker) runningProcessNames() ([]string, error) {
	cmd := exec.Command("tasklist", "/FO", "CSV", "/NH")
	cmd.SysProcAttr = hideWindow
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("error running tasklist: %w", err)
	}

	var names []string
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Formato CSV: "nome.exe","PID","Session Name","Session#","Mem Usage"
		fields := strings.Split(line, "\",\"")
		if len(fields) == 0 {
			continue
		}
		name := strings.Trim(fields[0], "\"")
		if name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}

func containsFold(haystack []string, needle string) bool {
	for _, h := range haystack {
		if strings.EqualFold(h, needle) {
			return true
		}
	}
	return false
}
