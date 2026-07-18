//go:build !windows

package blocker

// ProcessBlocker em sistemas não-Windows é um stub que não faz nada -
// existe só para o projeto compilar durante desenvolvimento fora de
// Windows. A distribuição final é sempre o binário Windows.
type ProcessBlocker struct{}

func NewProcessBlocker() *ProcessBlocker { return &ProcessBlocker{} }

func (p *ProcessBlocker) Enforce(processNames []string) ([]string, error) {
	return nil, nil
}
