package blocker

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestHostsBlocker(t *testing.T) (*HostsBlocker, string) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "hosts")
	initial := "127.0.0.1 localhost\n::1 localhost\n"
	if err := os.WriteFile(path, []byte(initial), 0644); err != nil {
		t.Fatalf("erro a preparar hosts de teste: %v", err)
	}
	return &HostsBlocker{Path: path}, path
}

func TestHostsBlocker_ApplyAndRemove(t *testing.T) {
	h, path := newTestHostsBlocker(t)

	if err := h.Apply([]string{"youtube.com", "Instagram.com"}); err != nil {
		t.Fatalf("Apply falhou: %v", err)
	}

	content, _ := os.ReadFile(path)
	s := string(content)

	for _, want := range []string{
		"127.0.0.1 youtube.com", "::1 youtube.com",
		"127.0.0.1 www.youtube.com", "::1 www.youtube.com",
		"127.0.0.1 instagram.com", "::1 instagram.com",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("esperava encontrar %q no hosts file, não encontrei:\n%s", want, s)
		}
	}
	// linhas originais preservadas
	if !strings.Contains(s, "127.0.0.1 localhost") {
		t.Errorf("linha original 'localhost' foi perdida:\n%s", s)
	}

	active, err := h.IsActive()
	if err != nil || !active {
		t.Fatalf("IsActive devia ser true depois de Apply, veio %v (err %v)", active, err)
	}

	if err := h.Remove(); err != nil {
		t.Fatalf("Remove falhou: %v", err)
	}
	content, _ = os.ReadFile(path)
	s = string(content)
	if strings.Contains(s, "youtube.com") {
		t.Errorf("youtube.com devia ter sido removido:\n%s", s)
	}
	if !strings.Contains(s, "127.0.0.1 localhost") {
		t.Errorf("linha original 'localhost' foi perdida no Remove:\n%s", s)
	}

	active, err = h.IsActive()
	if err != nil || active {
		t.Fatalf("IsActive devia ser false depois de Remove, veio %v (err %v)", active, err)
	}
}

func TestHostsBlocker_ApplyIsIdempotentAndReplacesBlock(t *testing.T) {
	h, path := newTestHostsBlocker(t)

	if err := h.Apply([]string{"a.com"}); err != nil {
		t.Fatalf("primeiro Apply falhou: %v", err)
	}
	if err := h.Apply([]string{"a.com"}); err != nil {
		t.Fatalf("segundo Apply (idempotente) falhou: %v", err)
	}
	content, _ := os.ReadFile(path)
	if strings.Count(string(content), "a.com") != 4 { // 127.0.0.1+::1 para a.com, e para www.a.com
		t.Fatalf("Apply repetido duplicou entradas:\n%s", string(content))
	}

	// trocar a lista deve substituir o bloco, não acumular
	if err := h.Apply([]string{"b.com"}); err != nil {
		t.Fatalf("Apply com lista nova falhou: %v", err)
	}
	content, _ = os.ReadFile(path)
	s := string(content)
	if strings.Contains(s, "a.com") {
		t.Errorf("bloco antigo (a.com) devia ter sido substituído:\n%s", s)
	}
	if !strings.Contains(s, "b.com") {
		t.Errorf("bloco novo (b.com) em falta:\n%s", s)
	}
}

func TestHostsBlocker_RemoveWithoutPriorApplyIsNoop(t *testing.T) {
	h, path := newTestHostsBlocker(t)
	before, _ := os.ReadFile(path)

	if err := h.Remove(); err != nil {
		t.Fatalf("Remove sem bloco prévio não devia dar erro: %v", err)
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatalf("Remove sem bloco prévio alterou o ficheiro:\nantes:\n%s\ndepois:\n%s", before, after)
	}
}

// TestHostsBlocker_ApplyClearsReadOnlyBeforeReplacing cobre o cenário
// que causou o "Access is denied" real no Windows: o hosts file
// marcado como só-leitura antes do Apply(). No Windows, MoveFileEx
// recusa substituir um destino read-only mesmo a correr como
// administrador - por isso writeAtomic tem de limpar esse atributo
// antes do rename (ver hosts.go). No Linux o rename() do POSIX não
// olha para as permissões do próprio ficheiro destino (só para a
// diretoria), por isso este teste não reproduz o bug do Windows tal
// e qual - mas confirma que o os.Chmod adicionado não quebra o fluxo
// normal quando o ficheiro já vem só-leitura.
func TestHostsBlocker_ApplyClearsReadOnlyBeforeReplacing(t *testing.T) {
	h, path := newTestHostsBlocker(t)

	if err := os.Chmod(path, 0444); err != nil {
		t.Fatalf("erro a marcar hosts de teste como só-leitura: %v", err)
	}

	if err := h.Apply([]string{"youtube.com"}); err != nil {
		t.Fatalf("Apply falhou com hosts file só-leitura: %v", err)
	}

	content, _ := os.ReadFile(path)
	if !strings.Contains(string(content), "127.0.0.1 youtube.com") {
		t.Errorf("bloqueio não foi aplicado apesar do Chmod: %s", content)
	}
}

// TestHostsBlocker_RejectsInvalidDomains cobre o fix de segurança em
// isValidHostname/buildManagedBlock: um domínio vindo de GET
// /agent/config com um "\n" embutido não pode resultar numa linha extra
// e arbitrária no hosts file - deve ser ignorado por completo, e o resto
// da lista continua a ser aplicado normalmente.
func TestHostsBlocker_RejectsInvalidDomains(t *testing.T) {
	h, path := newTestHostsBlocker(t)

	malicious := "evil.com\n0.0.0.0 example.com"
	if err := h.Apply([]string{malicious, "safe.com"}); err != nil {
		t.Fatalf("Apply falhou: %v", err)
	}

	content, _ := os.ReadFile(path)
	s := string(content)

	if strings.Contains(s, "example.com") {
		t.Fatalf("domínio malicioso injetou uma linha extra no hosts file:\n%s", s)
	}
	if strings.Contains(s, "evil.com") {
		t.Fatalf("domínio malicioso não devia ter sido escrito de todo:\n%s", s)
	}
	if !strings.Contains(s, "127.0.0.1 safe.com") {
		t.Errorf("domínio válido na mesma lista devia continuar a ser aplicado:\n%s", s)
	}
}

func TestIsValidHostname(t *testing.T) {
	cases := map[string]bool{
		"youtube.com":            true,
		"sub.example.co.uk":      true,
		"a.com":                  true,
		"evil.com\nextra line":   false,
		"evil.com\r\nextra line": false,
		"":                       false,
		" ":                      false,
		"has space.com":          false,
		strings.Repeat("a", 260): false,
	}
	for host, want := range cases {
		if got := isValidHostname(host); got != want {
			t.Errorf("isValidHostname(%q) = %v, want %v", host, got, want)
		}
	}
}

// uma máquina que ainda tenha o bloco de uma versão anterior do agente
// (marcador de início em português) deve ser corretamente reconhecida
// e substituída pelo bloco novo em inglês, sem duplicar entradas.
func TestHostsBlocker_CleansUpLegacyPortugueseMarker(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "hosts")
	legacyContent := `127.0.0.1 localhost
# >>> pmaxing-agent block start (gerido automaticamente, não editar à mão) >>>
127.0.0.1 oldsite.com
# <<< pmaxing-agent block end <<<
`
	if err := os.WriteFile(path, []byte(legacyContent), 0644); err != nil {
		t.Fatalf("erro a escrever hosts de teste: %v", err)
	}

	h := &HostsBlocker{Path: path}
	if err := h.Apply([]string{"newsite.com"}); err != nil {
		t.Fatalf("Apply falhou: %v", err)
	}

	content, _ := os.ReadFile(path)
	s := string(content)
	if strings.Contains(s, "oldsite.com") {
		t.Errorf("bloco legado não foi limpo, oldsite.com ainda presente:\n%s", s)
	}
	if strings.Count(s, "# >>> pmaxing-agent block start") != 1 {
		t.Errorf("esperava exatamente um bloco gerido, encontrei duplicação:\n%s", s)
	}
	if !strings.Contains(s, "127.0.0.1 newsite.com") {
		t.Errorf("novo domínio não foi aplicado:\n%s", s)
	}
}
