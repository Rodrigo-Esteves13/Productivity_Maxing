//go:build windows

// Package winconsole trata da consola do Windows quando o binário é
// compilado com -ldflags="-H=windowsgui" (ver README/Makefile) - nesse
// modo o processo arranca sem nenhuma janela de consola, o que é o que
// queremos para correr em background, mas também significa que não há
// onde os logs aparecerem. Em modo -debug, alocamos uma consola nova à
// mão via AllocConsole (API nativa do Windows, sem dependências) para
// veres os logs em tempo real como antes.
package winconsole

import (
	"os"
	"syscall"
)

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	procAllocConsole = kernel32.NewProc("AllocConsole")
)

// AllocDebugConsole cria uma consola nova e liga stdout/stderr a ela.
// Chamado só quando o agente arranca com -debug - no modo normal
// (windowsgui) não há consola nenhuma, e os logs vão só para o ficheiro.
func AllocDebugConsole() {
	procAllocConsole.Call()

	// AllocConsole por si só não redireciona os file descriptors do
	// Go para a consola nova - temos de abrir CONOUT$ explicitamente e
	// apontar os.Stdout/os.Stderr para lá.
	if conout, err := os.OpenFile("CONOUT$", os.O_RDWR, 0); err == nil {
		os.Stdout = conout
		os.Stderr = conout
	}
}
