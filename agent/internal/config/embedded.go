package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
)

// Técnica "self-extracting": o Windows (e o loader ELF/Mach-O nos outros
// SOs, já agora) só lê um executável até ao fim da secção que precisa -
// dados anexados a seguir ao fim lógico do ficheiro são ignorados pelo
// próprio SO ao correr o binário, mas continuam perfeitamente legíveis
// como bytes normais de dentro do próprio programa. É isso que o botão
// de download em /agent explora: pega no .exe "vanilla" (sem key
// nenhuma, o que fica em frontend/public/downloads/), gera uma API key
// nova para o utilizador, e cola essa key ao fim do ficheiro entre dois
// marcadores antes de disparar o download - tudo no browser, em
// memória, sem passar por nenhum servidor além do próprio Netlify a
// servir o .exe original.
const (
	embeddedMarkerStart = "\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-START--#\n"
	embeddedMarkerEnd   = "\n#--PMAXING-AGENT-EMBEDDED-CONFIG-V1-END--#\n"
)

// loadEmbedded procura uma configuração anexada ao fim do próprio
// executável em disco. Casos possíveis:
//   - Binário "vanilla" (sem marcador nenhum): devolve (nil, nil) - o
//     Load() cai então para PMAXING_API_KEY / config.json.
//   - Marcador de início encontrado mas sem marcador de fim a seguir:
//     tratado como coincidência acidental de bytes no meio do binário
//     compilado (não há garantia matemática de que a string do
//     marcador nunca apareça por acaso no código compilado), não como
//     erro - devolve (nil, nil) e deixa o Load() continuar a cadeia.
//   - Os dois marcadores encontrados mas o JSON lá dentro é inválido:
//     isto sim é um erro real (ex: download cortado a meio) - devolve
//     o erro para o Load() reportar alto em vez de arrancar com
//     metade de uma key.
func loadEmbedded() (*Config, error) {
	exePath, err := os.Executable()
	if err != nil {
		// Não crítico: sem saber o próprio caminho, simplesmente não
		// há como verificar config embutida - cai para as outras fontes.
		return nil, nil
	}

	data, err := os.ReadFile(exePath)
	if err != nil {
		return nil, nil
	}

	return parseEmbedded(data)
}

// parseEmbedded contém a lógica pura de procura/parsing dos marcadores,
// separada de loadEmbedded para poder ser testada com bytes em memória
// em vez de depender de os.Executable() + o binário de teste real do Go.
func parseEmbedded(data []byte) (*Config, error) {
	startMarker := []byte(embeddedMarkerStart)
	endMarker := []byte(embeddedMarkerEnd)

	// LastIndex, não Index: se por azar o marcador aparecer mais do
	// que uma vez, a config real é sempre a que foi anexada por
	// último (mais próxima do fim do ficheiro).
	startIdx := bytes.LastIndex(data, startMarker)
	if startIdx == -1 {
		return nil, nil // binário vanilla
	}

	payloadStart := startIdx + len(startMarker)
	endIdx := bytes.Index(data[payloadStart:], endMarker)
	if endIdx == -1 {
		// Marcador de início "encontrado" sem fim correspondente a
		// seguir - trata-se como coincidência acidental, não como
		// config real. Ver comentário da função.
		return nil, nil
	}

	rawJSON := data[payloadStart : payloadStart+endIdx]

	var cfg Config
	if err := json.Unmarshal(rawJSON, &cfg); err != nil {
		return nil, fmt.Errorf("bytes between markers are not valid JSON: %w", err)
	}
	return &cfg, nil
}
