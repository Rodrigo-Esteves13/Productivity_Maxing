//go:build !windows

package winconsole

// AllocDebugConsole não faz nada fora de Windows - em Linux/macOS o
// processo já corre sempre ligado à consola que o lançou, não há
// distinção "windowsgui vs consola" para replicar.
func AllocDebugConsole() {}
