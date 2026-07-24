package config

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// encodePayload espelha o que DownloadSetupButton.tsx faz do lado do
// browser (btoa) antes de colar o payload entre os marcadores - os testes
// têm de construir o mesmo formato V2 (base64), não JSON em claro.
func encodePayload(jsonStr string) string {
	return base64.StdEncoding.EncodeToString([]byte(jsonStr))
}

// buildFakeExe simula um "executável" com bytes anexados ao fim, sem
// precisar de compilar nada de verdade - loadEmbedded só olha para
// os.Executable() + os.ReadFile(), por isso um ficheiro qualquer com
// esse caminho serve perfeitamente para o teste.
func buildFakeExe(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "fake-agent.exe")
	if err := os.WriteFile(path, []byte(content), 0755); err != nil {
		t.Fatalf("erro a escrever exe falso: %v", err)
	}
	return path
}

// loadEmbeddedFromPath lê o "exe falso" do disco e passa os bytes por
// parseEmbedded - a mesma lógica que loadEmbedded usa depois de obter
// o caminho via os.Executable(), só que aqui com um caminho explícito
// para não depender do binário de teste real do Go.
func loadEmbeddedFromPath(t *testing.T, path string) (*Config, error) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("erro a ler exe falso: %v", err)
	}
	return parseEmbedded(data)
}

func TestLoadEmbedded_NoMarker(t *testing.T) {
	path := buildFakeExe(t, "conteudo qualquer de um binario sem config anexada")
	cfg, err := loadEmbeddedFromPath(t, path)
	if err != nil {
		t.Fatalf("esperava nil, obtive erro: %v", err)
	}
	if cfg != nil {
		t.Fatalf("esperava nil (binário vanilla), obtive %+v", cfg)
	}
}

func TestLoadEmbedded_ValidConfig(t *testing.T) {
	json := `{"api":{"baseUrl":"https://api.pmaxing.pt","apiKey":"pmx_test_123"}}`
	content := "binario fake" + embeddedMarkerStart + encodePayload(json) + embeddedMarkerEnd
	path := buildFakeExe(t, content)

	cfg, err := loadEmbeddedFromPath(t, path)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if cfg == nil {
		t.Fatal("esperava config embutida, obtive nil")
	}
	if cfg.API.APIKey != "pmx_test_123" {
		t.Errorf("APIKey = %q, esperava %q", cfg.API.APIKey, "pmx_test_123")
	}
	if cfg.API.BaseURL != "https://api.pmaxing.pt" {
		t.Errorf("BaseURL = %q, esperava %q", cfg.API.BaseURL, "https://api.pmaxing.pt")
	}
}

func TestLoadEmbedded_BaseURLOmitted(t *testing.T) {
	// baseUrl em falta no JSON embutido - Load() (não loadEmbedded) é
	// que resolve isto via applyDefaultsAndValidate; aqui só
	// confirmamos que o parsing não rebenta com o campo em falta.
	json := `{"api":{"apiKey":"pmx_test_456"}}`
	content := embeddedMarkerStart + encodePayload(json) + embeddedMarkerEnd
	path := buildFakeExe(t, content)

	cfg, err := loadEmbeddedFromPath(t, path)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if cfg == nil {
		t.Fatal("esperava config embutida, obtive nil")
	}
	if cfg.API.BaseURL != "" {
		t.Errorf("BaseURL deveria vir vazio do parsing (resolvido depois), obtive %q", cfg.API.BaseURL)
	}
}

func TestApplyDefaultsAndValidate_BaseURLFromEnv(t *testing.T) {
	t.Setenv("PMAXING_BASE_URL", "http://staging.example.test")
	cfg := &Config{API: APIConfig{APIKey: "pmx_test"}}
	if err := cfg.applyDefaultsAndValidate(); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if cfg.API.BaseURL != "http://staging.example.test" {
		t.Errorf("BaseURL = %q, esperava vir de PMAXING_BASE_URL", cfg.API.BaseURL)
	}
}

func TestApplyDefaultsAndValidate_NoBaseURLAnywhereFailsHard(t *testing.T) {
	// Sem baseUrl na config E sem PMAXING_BASE_URL no ambiente - não há
	// nenhum domínio hardcoded para cair como fallback, tem de falhar
	// alto em vez de assumir silenciosamente produção (ou outro domínio).
	t.Setenv("PMAXING_BASE_URL", "")
	cfg := &Config{API: APIConfig{APIKey: "pmx_test"}}
	err := cfg.applyDefaultsAndValidate()
	if err == nil {
		t.Fatal("esperava erro sem baseUrl nem PMAXING_BASE_URL definidos, obtive nil")
	}
	if !strings.Contains(err.Error(), "PMAXING_BASE_URL") {
		t.Errorf("mensagem de erro devia mencionar PMAXING_BASE_URL: %v", err)
	}
}

func TestLoadEmbedded_InvalidBase64(t *testing.T) {
	// Bytes entre os marcadores que nem sequer são base64 válido (ex:
	// download do .exe cortado a meio).
	content := embeddedMarkerStart + "isto nao e base64 valido!!!" + embeddedMarkerEnd
	path := buildFakeExe(t, content)

	_, err := loadEmbeddedFromPath(t, path)
	if err == nil {
		t.Fatal("esperava erro com base64 inválido entre marcadores, obtive nil")
	}
	if !strings.Contains(err.Error(), "valid base64") {
		t.Errorf("mensagem de erro inesperada: %v", err)
	}
}

func TestLoadEmbedded_ValidBase64ButInvalidJSON(t *testing.T) {
	// base64 válido, mas o que descodifica não é JSON válido.
	content := embeddedMarkerStart + encodePayload("{isto nao e json valido") + embeddedMarkerEnd
	path := buildFakeExe(t, content)

	_, err := loadEmbeddedFromPath(t, path)
	if err == nil {
		t.Fatal("esperava erro com JSON inválido depois de descodificar, obtive nil")
	}
	if !strings.Contains(err.Error(), "valid JSON") {
		t.Errorf("mensagem de erro inesperada: %v", err)
	}
}

func TestLoadEmbedded_AccidentalStartMarkerCollision(t *testing.T) {
	// Simula o marcador de início a aparecer "por acaso" no meio do
	// binário compilado (ex: strings de debug, símbolos), mas sem o
	// marcador de fim correspondente a seguir - não é config real.
	content := "lixo antes" + embeddedMarkerStart + "isto nao e uma config, e so uma coincidencia de bytes sem marcador de fim"
	path := buildFakeExe(t, content)

	cfg, err := loadEmbeddedFromPath(t, path)
	if err != nil {
		t.Fatalf("colisão acidental não devia dar erro, devia ser ignorada: %v", err)
	}
	if cfg != nil {
		t.Fatalf("esperava nil (tratado como coincidência, não config real), obtive %+v", cfg)
	}
}

func TestLoadEmbedded_LastOccurrenceWins(t *testing.T) {
	// Se o marcador aparecer mais do que uma vez (não devia acontecer
	// em uso normal, mas não custa garantir), a config anexada por
	// último (mais perto do fim do ficheiro) é a que vale.
	oldJSON := `{"api":{"apiKey":"pmx_old_key"}}`
	newJSON := `{"api":{"apiKey":"pmx_new_key"}}`
	content := embeddedMarkerStart + encodePayload(oldJSON) + embeddedMarkerEnd +
		embeddedMarkerStart + encodePayload(newJSON) + embeddedMarkerEnd
	path := buildFakeExe(t, content)

	cfg, err := loadEmbeddedFromPath(t, path)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if cfg == nil || cfg.API.APIKey != "pmx_new_key" {
		t.Fatalf("esperava a key mais recente 'pmx_new_key', obtive %+v", cfg)
	}
}
