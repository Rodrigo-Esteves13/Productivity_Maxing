package apiclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Difficulty espelha o enum Difficulty do schema.prisma do backend.
type Difficulty string

const (
	VeryEasy Difficulty = "VERY_EASY"
	Easy     Difficulty = "EASY"
	Medium   Difficulty = "MEDIUM"
	Hard     Difficulty = "HARD"
	VeryHard Difficulty = "VERY_HARD"
)

var difficultyRank = map[Difficulty]int{
	VeryEasy: 1,
	Easy:     2,
	Medium:   3,
	Hard:     4,
	VeryHard: 5,
}

// Rank devolve o peso numérico da dificuldade (0 se for um valor desconhecido).
func (d Difficulty) Rank() int {
	return difficultyRank[d]
}

// ProgressStatus espelha o enum ProgressStatus do schema.prisma.
type ProgressStatus string

const (
	Ahead      ProgressStatus = "AHEAD"
	OnTrack    ProgressStatus = "ON_TRACK"
	Behind     ProgressStatus = "BEHIND"
	VeryBehind ProgressStatus = "VERY_BEHIND"
	Completed  ProgressStatus = "COMPLETED"
)

// progressRank ordena da situação melhor para a pior. COMPLETED fica de
// fora de propósito - não é um "grau de atraso", é a task estar feita, e
// nunca deve contar para ativar bloqueio (ver rules.hasMinProgressStatus).
var progressRank = map[ProgressStatus]int{
	Ahead:      1,
	OnTrack:    2,
	Behind:     3,
	VeryBehind: 4,
}

// Rank devolve o peso numérico do progresso (0 se for COMPLETED ou um
// valor desconhecido).
func (p ProgressStatus) Rank() int {
	return progressRank[p]
}

// TriggerMode define como as regras dentro de TriggerRules se combinam.
type TriggerMode string

const (
	TriggerAny TriggerMode = "ANY"
	TriggerAll TriggerMode = "ALL"
)

// FailMode define o que o agente faz quando não consegue contactar a API.
type FailMode string

const (
	FailClosed FailMode = "CLOSED"
	FailOpen   FailMode = "OPEN"
)

// TriggerRules espelha o corpo devolvido por GET /agent/config - define
// quando o bloqueio deve ativar, com base nas tasks da conta. Editável na
// página /agent do site; o agente limita-se a ler o que lá estiver.
type TriggerRules struct {
	Mode               TriggerMode     `json:"triggerMode"`
	HasOverdueTasks    bool            `json:"hasOverdueTasks"`
	HasOverdueCheckins bool            `json:"hasOverdueCheckins"`
	MinDifficultyToday *Difficulty     `json:"minDifficultyToday"`
	AnyTaskToday       bool            `json:"anyTaskToday"`
	MinProgressStatus  *ProgressStatus `json:"minProgressStatus"`
}

// BlockingConfig lista o que deve ser bloqueado quando as TriggerRules
// decidirem que o bloqueio deve estar ativo.
type BlockingConfig struct {
	Processes []string `json:"blockedProcesses"`
	Domains   []string `json:"blockedDomains"`
	FailMode  FailMode `json:"failMode"`
}

// AgentConfig é o corpo completo devolvido por GET /agent/config.
type AgentConfig struct {
	TriggerRules        TriggerRules
	Blocking            BlockingConfig
	PollIntervalSeconds int  `json:"pollIntervalSeconds"`
	IsConfigured        bool `json:"isConfigured"`
}

// UnmarshalJSON existe porque a resposta do backend vem "achatada" (os
// campos de trigger rules e de blocking estão todos ao mesmo nível do
// objeto, não em sub-objetos "triggerRules"/"blocking") - fazemos o
// unmarshal para uma struct achatada e depois reorganizamos para a forma
// mais arrumada que o resto do agente usa.
func (a *AgentConfig) UnmarshalJSON(data []byte) error {
	var flat struct {
		TriggerMode         TriggerMode     `json:"triggerMode"`
		HasOverdueTasks     bool            `json:"hasOverdueTasks"`
		HasOverdueCheckins  bool            `json:"hasOverdueCheckins"`
		MinDifficultyToday  *Difficulty     `json:"minDifficultyToday"`
		AnyTaskToday        bool            `json:"anyTaskToday"`
		MinProgressStatus   *ProgressStatus `json:"minProgressStatus"`
		BlockedProcesses    []string        `json:"blockedProcesses"`
		BlockedDomains      []string        `json:"blockedDomains"`
		FailMode            FailMode        `json:"failMode"`
		PollIntervalSeconds int             `json:"pollIntervalSeconds"`
		IsConfigured        bool            `json:"isConfigured"`
	}
	if err := json.Unmarshal(data, &flat); err != nil {
		return err
	}

	a.TriggerRules = TriggerRules{
		Mode:               flat.TriggerMode,
		HasOverdueTasks:    flat.HasOverdueTasks,
		HasOverdueCheckins: flat.HasOverdueCheckins,
		MinDifficultyToday: flat.MinDifficultyToday,
		AnyTaskToday:       flat.AnyTaskToday,
		MinProgressStatus:  flat.MinProgressStatus,
	}
	a.Blocking = BlockingConfig{
		Processes: flat.BlockedProcesses,
		Domains:   flat.BlockedDomains,
		FailMode:  flat.FailMode,
	}
	a.PollIntervalSeconds = flat.PollIntervalSeconds
	a.IsConfigured = flat.IsConfigured
	return nil
}

// FetchAgentConfig chama GET /agent/config - a mesma configuração que
// consegues editar na página /agent do site.
func (c *Client) FetchAgentConfig(ctx context.Context) (*AgentConfig, error) {
	url := c.baseURL + "/agent/config"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("error building request for /agent/config: %w", err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error calling /agent/config: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response from /agent/config: %w", err)
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid or revoked API key (401 on /agent/config) - generate a new one on the /agent page of the site")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected response from /agent/config: %d %s", resp.StatusCode, string(body))
	}

	var cfg AgentConfig
	if err := json.Unmarshal(body, &cfg); err != nil {
		return nil, fmt.Errorf("error parsing JSON from /agent/config: %w", err)
	}

	return &cfg, nil
}
