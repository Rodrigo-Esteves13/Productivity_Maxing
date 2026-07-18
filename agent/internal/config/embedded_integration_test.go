package config

import (
	"os"
	"testing"
)

// Teste de integração real (não fake): confirma que o .exe vanilla
// verdadeiramente compilado (não um fixture de teste) é lido como
// "sem config embutida" por loadEmbedded/parseEmbedded - importante
// porque os próprios marcadores, sendo constantes Go, ficam
// embutidos no binário compilado (na secção de dados/rodata) mesmo
// sem nenhuma config real ter sido anexada.
func TestParseEmbedded_RealVanillaBinary(t *testing.T) {
	path := os.Getenv("PMAXING_TEST_VANILLA_EXE")
	if path == "" {
		t.Skip("PMAXING_TEST_VANILLA_EXE não definida, salta teste de integração")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("erro a ler binário real: %v", err)
	}
	cfg, err := parseEmbedded(data)
	if err != nil {
		t.Fatalf("binário vanilla real NÃO deveria dar erro ao procurar config embutida, deu: %v", err)
	}
	if cfg != nil {
		t.Fatalf("binário vanilla real NÃO deveria ter config embutida, encontrou: %+v", cfg)
	}
}
