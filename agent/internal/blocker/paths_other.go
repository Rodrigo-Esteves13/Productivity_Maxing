//go:build !windows

package blocker

// HostsFilePath devolve o caminho do hosts file em sistemas Unix-like.
// Isto existe só para o projeto compilar e correr em Linux/macOS durante
// desenvolvimento/testes - a distribuição final é sempre para Windows.
func HostsFilePath() string {
	return "/etc/hosts"
}
