//go:build windows

package blocker

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"
)

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

	var killed []string
	for _, target := range processNames {
		target = strings.TrimSpace(target)
		if target == "" {
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
