//go:build windows

package blocker

import "os/exec"

// IsElevated diz se o processo atual está a correr com privilégios de
// administrador. Usa o truque clássico "net session": este comando só
// tem sucesso (exit code 0) quando corrido como admin, falha com "Acesso
// negado" caso contrário. É mais leve do que trazer
// golang.org/x/sys/windows só para chamar OpenProcessToken.
func IsElevated() bool {
	cmd := exec.Command("net", "session")
	cmd.SysProcAttr = hideWindow
	return cmd.Run() == nil
}
