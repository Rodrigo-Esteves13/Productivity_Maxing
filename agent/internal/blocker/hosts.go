// Package blocker trata da aplicação e remoção efetiva do bloqueio:
// domínios via hosts file (hosts.go) e processos via taskkill (process.go).
package blocker

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

const (
	// markerStart/markerEnd delimitam o bloco que o agente gere dentro do
	// hosts file. Nunca tocamos em nenhuma linha fora deste bloco - assim
	// o agente convive bem com outras entradas que já lá estejam (VPNs,
	// Docker, etc) e é sempre seguro remover o bloco inteiro.
	markerStart = "# >>> pmaxing-agent block start (managed automatically, do not edit by hand) >>>"
	markerEnd   = "# <<< pmaxing-agent block end <<<"

	// legacyMarkerStart: versões anteriores do agente (antes desta
	// tradução) escreviam o marcador de início em português - o de fim
	// já era igual nas duas versões, por isso só precisamos de um
	// segundo caso para o de início. Sem isto, uma máquina que já
	// tivesse o bloco antigo ficaria com ele órfão para sempre - o
	// binário novo nunca o reconheceria como "o bloco gerido", e
	// passaria a acrescentar um bloco novo (em inglês) a seguir,
	// duplicando entradas em vez de as substituir. Por isso
	// reconhecemos os dois ao ler (ver readWithoutManagedBlock), mas
	// escrevemos sempre com o marcador novo.
	legacyMarkerStart = "# >>> pmaxing-agent block start (gerido automaticamente, não editar à mão) >>>"

	// redirectIP/redirectIPv6: para onde os domínios bloqueados apontam.
	// 127.0.0.1 em vez de 0.0.0.0 porque alguns browsers tratam 0.0.0.0
	// de forma inconsistente; 127.0.0.1 dá sempre "não consigo ligar-me"
	// imediato. Só bloquear o A record (IPv4) não chega: numa rede com
	// IPv6 ativo, o browser prefere o AAAA record devolvido pelo DNS
	// normal sempre que não haja entrada IPv6 no hosts a dizer o
	// contrário - por isso bloqueamos também o AAAA com ::1.
	redirectIP   = "127.0.0.1"
	redirectIPv6 = "::1"
)

// HostsBlocker aplica/remove o bloqueio de domínios editando o hosts file
// do sistema operativo.
type HostsBlocker struct {
	// Path é o caminho absoluto para o hosts file. Em Windows é
	// C:\Windows\System32\drivers\etc\hosts - ver HostsFilePath() no
	// ficheiro paths_windows.go.
	Path string
}

// New cria um HostsBlocker apontado para o caminho do hosts file correto
// para o sistema operativo atual.
func New() *HostsBlocker {
	return &HostsBlocker{Path: HostsFilePath()}
}

// Apply garante que todos os domínios em `domains` estão bloqueados. É
// idempotente: chamar duas vezes seguidas com a mesma lista não duplica
// entradas, e chamar com uma lista diferente da anterior atualiza o bloco
// inteiro para refletir a nova lista.
func (h *HostsBlocker) Apply(domains []string) error {
	lines, blockStart, blockEnd, _, err := h.readWithoutManagedBlock()
	if err != nil {
		return err
	}

	managed := buildManagedBlock(domains)

	var out []string
	out = append(out, lines[:blockStart]...)
	out = append(out, managed...)
	out = append(out, lines[blockEnd:]...)

	return writeAtomic(h.Path, out)
}

// Remove tira o bloco gerido pelo agente do hosts file, sem tocar em mais
// nada. Chamado quando as trigger rules deixam de exigir bloqueio.
func (h *HostsBlocker) Remove() error {
	lines, blockStart, blockEnd, found, err := h.readWithoutManagedBlock()
	if err != nil {
		return err
	}
	if !found {
		// já não havia bloco nenhum - nada a fazer.
		return nil
	}

	var out []string
	out = append(out, lines[:blockStart]...)
	out = append(out, lines[blockEnd:]...)

	return writeAtomic(h.Path, out)
}

// IsActive diz se o bloco gerido pelo agente está atualmente presente no
// hosts file (útil para logging/estado, sem teres de repetir Apply).
func (h *HostsBlocker) IsActive() (bool, error) {
	_, _, _, found, err := h.readWithoutManagedBlock()
	if err != nil {
		return false, err
	}
	return found, nil
}

// readWithoutManagedBlock lê o hosts file e devolve todas as linhas fora
// do bloco gerido pelo agente, mais os índices [blockStart:blockEnd) em
// `lines` onde esse bloco deve ser reinserido, e `found` a indicar se o
// bloco já existia no ficheiro (distinto de "existia mas estava vazio" -
// por isso não dá para inferir isto só a partir de blockStart==blockEnd,
// que também acontece legitimamente quando o bloco não existe de todo).
func (h *HostsBlocker) readWithoutManagedBlock() (lines []string, blockStart, blockEnd int, found bool, err error) {
	f, err := os.Open(h.Path)
	if err != nil {
		return nil, 0, 0, false, fmt.Errorf("could not open the hosts file (%s) - the agent needs to run as administrator: %w", h.Path, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	inBlock := false
	start, end := -1, -1
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.TrimSpace(line) == markerStart || strings.TrimSpace(line) == legacyMarkerStart:
			start = len(lines)
			inBlock = true
			continue
		case strings.TrimSpace(line) == markerEnd:
			end = len(lines)
			inBlock = false
			continue
		}
		if inBlock {
			// linha dentro do bloco antigo - ignorada, vai ser
			// substituída pelo bloco novo.
			continue
		}
		lines = append(lines, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, 0, 0, false, fmt.Errorf("error reading %s: %w", h.Path, err)
	}

	if start == -1 {
		// não havia bloco - o "buraco" fica no fim do ficheiro.
		return lines, len(lines), len(lines), false, nil
	}
	return lines, start, end, true, nil
}

func buildManagedBlock(domains []string) []string {
	if len(domains) == 0 {
		return nil
	}
	block := []string{markerStart}
	seen := make(map[string]bool)
	addHost := func(host string) {
		if host == "" || seen[host] {
			return
		}
		seen[host] = true
		// Uma linha IPv4 e uma IPv6 por nome - ver comentário de
		// redirectIPv6 acima: sem a linha IPv6, um browser numa rede
		// com IPv6 ativo ignora o bloqueio IPv4 e liga-se na mesma via
		// AAAA record normal do DNS.
		block = append(block, fmt.Sprintf("%s %s", redirectIP, host))
		block = append(block, fmt.Sprintf("%s %s", redirectIPv6, host))
	}
	for _, d := range domains {
		d = strings.ToLower(strings.TrimSpace(d))
		if d == "" {
			continue
		}
		addHost(d)
		// bloqueamos também o subdomínio www. explícito - o hosts file
		// não faz match de wildcard, cada nome tem de estar listado.
		addHost("www." + d)
	}
	block = append(block, markerEnd)
	return block
}

// writeAtomic escreve as linhas para um ficheiro temporário no mesmo
// diretório e depois faz rename - evita deixar o hosts file corrompido a
// meio se o processo for interrompido a meio da escrita.
func writeAtomic(path string, lines []string) error {
	tmpPath := path + ".pmaxing-tmp"

	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("could not write temporary hosts file (you need to run as administrator): %w", err)
	}

	w := bufio.NewWriter(f)
	for _, line := range lines {
		if _, err := w.WriteString(line + "\n"); err != nil {
			f.Close()
			os.Remove(tmpPath)
			return fmt.Errorf("error writing %s: %w", tmpPath, err)
		}
	}
	if err := w.Flush(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	// O hosts file do Windows costuma vir marcado como "só-leitura"
	// (atributo de ficheiro, não permissão de ACL) - por vezes por
	// definição do próprio Windows, por vezes posto lá por
	// antivírus/segurança como proteção contra hijacking do hosts.
	// MoveFileEx (usado por os.Rename no Windows) recusa substituir um
	// destino read-only mesmo a correr como administrador, e falha com
	// "Access is denied" - por isso limpamos sempre o atributo antes de
	// tentar o rename. Se o ficheiro ainda não existir (primeira vez),
	// Chmod falha e ignoramos o erro propositadamente.
	_ = os.Chmod(path, 0644)

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("error replacing %s with the updated file: %w (if the error is \"Access is denied\", check that no antivirus is blocking writes to the hosts file, and that the file is not marked read-only)", path, err)
	}
	return nil
}
