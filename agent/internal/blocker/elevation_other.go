//go:build !windows

package blocker

import "os"

// IsElevated em sistemas não-Windows verifica se estamos a correr como
// root - só relevante para desenvolvimento/testes fora de Windows.
func IsElevated() bool {
	return os.Geteuid() == 0
}
