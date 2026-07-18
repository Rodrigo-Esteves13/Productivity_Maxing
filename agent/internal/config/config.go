// Package config trata da leitura da configuração local do agente -
// desde a Fase 5.1, só o essencial para autenticar (baseUrl + apiKey).
// Suporta três fontes, por ordem de prioridade:
//  1. Configuração anexada ao fim do próprio executável (técnica
//     "self-extracting" - ver embedded.go). É assim que o botão de
//     download em /agent produz um .exe já pronto a usar, sem o
//     utilizador ter de copiar a key à mão.
//  2. Variável de ambiente PMAXING_API_KEY (+ opcional PMAXING_BASE_URL)
//  3. Um ficheiro JSON local (path passado em -config)
//
// A variável de ambiente existe para quem só quer correr
// `pmaxing-agent.exe -set-key A_TUA_KEY` e nunca mais tocar em JSON
// nenhum - ver main.go para a flag -set-key.
//
// IMPORTANTE: não há nenhum domínio da API hardcoded em lado nenhum deste
// pacote. Se `api.baseUrl` vier vazio de qualquer uma das três fontes
// acima, applyDefaultsAndValidate tenta PMAXING_BASE_URL do ambiente antes
// de desistir - nunca assume silenciosamente um domínio de produção fixo.
// O mesmo vale do lado do frontend: DownloadSetupButton.tsx lê
// import.meta.env.VITE_API_URL em vez de qualquer string fixa, para o
// .exe gerado apontar sempre para o backend real desta build (produção,
// staging, ou local), nunca para um domínio hardcoded que ignoraria isso.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// APIConfig agrupa tudo o que é preciso para falar com o backend.
type APIConfig struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
	// RequestTimeoutSeconds: timeout de cada pedido HTTP individual.
	RequestTimeoutSeconds int `json:"requestTimeoutSeconds"`
	// BootstrapPollIntervalSeconds: intervalo usado só até ao agente
	// conseguir buscar a configuração real ao backend pela primeira vez -
	// depois disso, o valor guardado na página /agent é que manda.
	BootstrapPollIntervalSeconds int `json:"bootstrapPollIntervalSeconds"`
}

// RequestTimeout devolve o timeout de cada pedido HTTP já convertido.
func (a APIConfig) RequestTimeout() time.Duration {
	return time.Duration(a.RequestTimeoutSeconds) * time.Second
}

// BootstrapPollInterval devolve o intervalo de arranque já convertido.
func (a APIConfig) BootstrapPollInterval() time.Duration {
	return time.Duration(a.BootstrapPollIntervalSeconds) * time.Second
}

// Config é a raiz da configuração local do agente.
type Config struct {
	API APIConfig `json:"api"`
}

// Load lê a configuração pela ordem de prioridade descrita no topo do
// ficheiro: primeiro tenta a config embutida no próprio .exe, depois
// PMAXING_API_KEY no ambiente, e só cai para o ficheiro em `path` se
// nenhuma das anteriores existir.
func Load(path string) (*Config, error) {
	embedded, err := loadEmbedded()
	if err != nil {
		// Isto só acontece se os marcadores existirem mas o conteúdo
		// entre eles estiver corrompido (ex: download do .exe cortado
		// a meio) - nesse caso é melhor falhar alto do que ignorar
		// silenciosamente uma config que devia estar ali.
		return nil, fmt.Errorf("config embedded in the executable is corrupted: %w", err)
	}
	if embedded != nil {
		if err := embedded.applyDefaultsAndValidate(); err != nil {
			return nil, err
		}
		return embedded, nil
	}

	if apiKey := os.Getenv("PMAXING_API_KEY"); apiKey != "" {
		// BaseURL fica vazio aqui de propósito - applyDefaultsAndValidate
		// é que resolve a partir de PMAXING_BASE_URL (fonte única, nunca
		// duplicada), e falha alto se também essa não estiver definida.
		cfg := &Config{API: APIConfig{BaseURL: os.Getenv("PMAXING_BASE_URL"), APIKey: apiKey}}
		if err := cfg.applyDefaultsAndValidate(); err != nil {
			return nil, err
		}
		return cfg, nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("no embedded config, no PMAXING_API_KEY set in the environment, and could not read %q: %w (download the pre-configured .exe from /agent, run \"pmaxing-agent.exe -set-key YOUR_KEY\", or create the file)", path, err)
	}

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("invalid config.json: %w", err)
	}
	if err := cfg.applyDefaultsAndValidate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Config) applyDefaultsAndValidate() error {
	if c.API.BaseURL == "" {
		// Nunca um domínio fixo aqui - só a variável de ambiente. Se
		// nem essa estiver definida, falhamos alto em vez de assumir
		// silenciosamente produção (ou qualquer outro domínio).
		if envURL := os.Getenv("PMAXING_BASE_URL"); envURL != "" {
			c.API.BaseURL = envURL
		} else {
			return fmt.Errorf("api.baseUrl is not set and PMAXING_BASE_URL is not set in the environment - there is no hardcoded fallback domain, set one of the two explicitly")
		}
	}
	if c.API.APIKey == "" {
		return fmt.Errorf("api.apiKey is required - generate one on the /agent page of the site")
	}
	if c.API.RequestTimeoutSeconds <= 0 {
		// 45s, não 10s: o Render (free tier) hiberna a instância do
		// backend ao fim de um período de inatividade, e o primeiro
		// pedido depois disso pode demorar 30-50s a "acordar" a
		// instância antes de responder - com 10s o agente desistia
		// sempre nesse cenário com "context deadline exceeded", mesmo
		// com o backend saudável.
		c.API.RequestTimeoutSeconds = 45
	}
	if c.API.BootstrapPollIntervalSeconds <= 0 {
		c.API.BootstrapPollIntervalSeconds = 60
	}
	return nil
}
