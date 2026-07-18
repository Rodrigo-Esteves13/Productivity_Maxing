//go:build windows

package blocker

import (
	"os"
	"path/filepath"
)

// HostsFilePath devolve o caminho do hosts file no Windows:
// C:\Windows\System32\drivers\etc\hosts. Construído a partir de
// %SystemRoot% em vez de hardcoded "C:\Windows", para funcionar também
// nos (raros) sistemas onde o Windows está instalado noutra drive.
func HostsFilePath() string {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = `C:\Windows`
	}
	return filepath.Join(root, "System32", "drivers", "etc", "hosts")
}
