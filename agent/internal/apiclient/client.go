// Package apiclient encapsula os pedidos HTTP à API do Productivity
// Maxing. Usa apenas net/http da standard library - o backend já expõe
// tudo o que precisamos via JSON simples, não há necessidade de nenhuma
// biblioteca de terceiros aqui.
package apiclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"pmaxing-agent/internal/config"
)

// Area espelha o objeto Area tal como vem embutido em cada Task
// (TASK_INCLUDE inclui a relação "area" completa no backend).
type Area struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ColorHex string `json:"colorHex"`
}

// Task espelha a forma exata do JSON devolvido por TasksService.toResponse()
// no backend: os campos internos taskTypeId/academicTypeId são substituídos
// por "type" (string key) e "academicType" (string key ou null).
type Task struct {
	ID                    string         `json:"id"`
	UserID                string         `json:"userId"`
	AreaID                string         `json:"areaId"`
	Title                 string         `json:"title"`
	Date                  time.Time      `json:"date"`
	Topics                *string        `json:"topics"`
	WeightPercentage      *float64       `json:"weightPercentage"`
	Difficulty            Difficulty     `json:"difficulty"`
	ProgressStatus        ProgressStatus `json:"progressStatus"`
	ReferenceLink         *string        `json:"referenceLink"`
	TargetGrade           *float64       `json:"targetGrade"`
	RealGrade             *float64       `json:"realGrade"`
	CompletedAt           *time.Time     `json:"completedAt"`
	LastOverdueCheckAt    *time.Time     `json:"lastOverdueCheckAt"`
	GoogleCalendarEventID *string        `json:"googleCalendarEventId"`
	CalendarDurationMins  *int           `json:"calendarDurationMinutes"`
	CreatedAt             time.Time      `json:"createdAt"`
	Type                  string         `json:"type"`
	AcademicType          *string        `json:"academicType"`
	Area                  Area           `json:"area"`
}

// Client fala com a API usando autenticação por x-api-key (ver
// ApiKeyStrategy no backend - JwtOrApiKeyAuthGuard aceita este header como
// alternativa ao cookie JWT normal).
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// New cria um Client a partir da configuração carregada de config.json.
func New(cfg config.APIConfig) *Client {
	return &Client{
		baseURL: cfg.BaseURL,
		apiKey:  cfg.APIKey,
		http: &http.Client{
			Timeout: cfg.RequestTimeout(),
		},
	}
}

// TasksToday chama GET /tasks/today.
func (c *Client) TasksToday(ctx context.Context) ([]Task, error) {
	return c.getTasks(ctx, "/tasks/today")
}

// TasksOverdueCheckins chama GET /tasks/overdue-checkins.
func (c *Client) TasksOverdueCheckins(ctx context.Context) ([]Task, error) {
	return c.getTasks(ctx, "/tasks/overdue-checkins")
}

// TasksAll chama GET /tasks - devolve TODAS as tasks da conta (passadas,
// hoje e futuras), sem filtro nenhum no backend. Só é chamado quando a
// trigger rule HasOverdueTasks está ativa, porque não há endpoint mais
// específico para "tasks overdue independentemente de check-in" e este
// pedido pode ser pesado em contas com muito histórico.
func (c *Client) TasksAll(ctx context.Context) ([]Task, error) {
	return c.getTasks(ctx, "/tasks")
}

func (c *Client) getTasks(ctx context.Context, path string) ([]Task, error) {
	url := c.baseURL + path

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("error building request for %s: %w", path, err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error calling %s: %w", path, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response from %s: %w", path, err)
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid or revoked API key (401 on %s) - generate a new one at /auth/api-keys", path)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected response from %s: %d %s", path, resp.StatusCode, string(body))
	}

	var tasks []Task
	if err := json.Unmarshal(body, &tasks); err != nil {
		return nil, fmt.Errorf("error parsing JSON from %s: %w", path, err)
	}

	return tasks, nil
}
