// Package apiclient encapsula os pedidos HTTP à API do Productivity
// Maxing. Usa apenas net/http da standard library - o backend já expõe
// tudo o que precisamos via JSON simples, não há necessidade de nenhuma
// biblioteca de terceiros aqui.
package apiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"pmaxing-agent/internal/config"
)

// ErrUnauthorized marca um 401 da API (key revogada ou apagada). O main.go
// distingue-o de uma falha de rede: com a key morta nao faz sentido manter
// o ultimo bloqueio para sempre (E-13).
var ErrUnauthorized = errors.New("invalid or revoked API key")

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
	DateCertainty         DateCertainty  `json:"dateCertainty"`
	IsBlocked             bool           `json:"isBlocked"`
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

// Paginacao de GET /tasks: o modo array do backend esta limitado a 1000
// linhas (header x-result-truncated) e descarta as mais recentes, por isso
// TasksAll segue a paginacao por cursor.
const (
	tasksPageLimit = 200
	tasksMaxPages  = 100
)

// errCursorRejected marca um 400 numa pagina com cursor (cursor expirado ou
// invalido) - TasksAll recomeca uma vez da pagina 1.
var errCursorRejected = errors.New("cursor rejected by API")

type tasksPage struct {
	Items      []Task  `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

// TasksAll chama GET /tasks?paginated=true&limit=200 e segue nextCursor ate
// ser null, devolvendo todas as tasks da conta (passadas, hoje e futuras).
// Limites: no maximo tasksMaxPages paginas; ids duplicados entre paginas sao
// ignorados; um 400 numa pagina com cursor recomeca uma unica vez da pagina 1.
// Se o servidor responder com um array simples (backend antigo) esse array e
// o resultado completo. So e chamado quando a trigger rule HasOverdueTasks
// esta ativa, porque nao ha endpoint mais especifico.
func (c *Client) TasksAll(ctx context.Context) ([]Task, error) {
	tasks, err := c.tasksAllOnce(ctx)
	if errors.Is(err, errCursorRejected) {
		tasks, err = c.tasksAllOnce(ctx)
	}
	if errors.Is(err, errCursorRejected) {
		return nil, fmt.Errorf("GET /tasks: cursor rejected again after restart: %w", err)
	}
	return tasks, err
}

func (c *Client) tasksAllOnce(ctx context.Context) ([]Task, error) {
	var out []Task
	seen := make(map[string]struct{})
	cursor := ""
	for page := 0; page < tasksMaxPages; page++ {
		q := url.Values{}
		q.Set("paginated", "true")
		q.Set("limit", strconv.Itoa(tasksPageLimit))
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		status, body, err := c.doGet(ctx, "/tasks?"+q.Encode())
		if err != nil {
			return nil, err
		}
		if status == http.StatusBadRequest && cursor != "" {
			return nil, errCursorRejected
		}
		if err := statusError("/tasks", status, body); err != nil {
			return nil, err
		}

		trimmed := bytes.TrimSpace(body)
		if len(trimmed) > 0 && trimmed[0] == '[' {
			// Backend antigo: array simples = resultado completo.
			var arr []Task
			if err := json.Unmarshal(trimmed, &arr); err != nil {
				return nil, fmt.Errorf("error parsing JSON from /tasks: %w", err)
			}
			return appendUnique(out, seen, arr), nil
		}

		var env tasksPage
		if err := json.Unmarshal(trimmed, &env); err != nil {
			return nil, fmt.Errorf("error parsing JSON from /tasks: %w", err)
		}
		out = appendUnique(out, seen, env.Items)
		if env.NextCursor == nil || *env.NextCursor == "" {
			return out, nil
		}
		cursor = *env.NextCursor
	}
	return nil, fmt.Errorf("GET /tasks: more than %d pages, aborting", tasksMaxPages)
}

func appendUnique(out []Task, seen map[string]struct{}, items []Task) []Task {
	for _, t := range items {
		if _, dup := seen[t.ID]; dup {
			continue
		}
		seen[t.ID] = struct{}{}
		out = append(out, t)
	}
	return out
}

// doGet faz o GET autenticado e devolve status + corpo.
func (c *Client) doGet(ctx context.Context, path string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("error building request for %s: %w", path, err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("network error calling %s: %w", path, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, fmt.Errorf("error reading response from %s: %w", path, err)
	}
	return resp.StatusCode, body, nil
}

func statusError(path string, status int, body []byte) error {
	if status == http.StatusUnauthorized {
		return fmt.Errorf("%w (401 on %s) - generate a new one on the /agent page of the site", ErrUnauthorized, path)
	}
	if status != http.StatusOK {
		return fmt.Errorf("unexpected response from %s: %d %s", path, status, string(body))
	}
	return nil
}

func (c *Client) getTasks(ctx context.Context, path string) ([]Task, error) {
	status, body, err := c.doGet(ctx, path)
	if err != nil {
		return nil, err
	}
	if err := statusError(path, status, body); err != nil {
		return nil, err
	}

	var tasks []Task
	if err := json.Unmarshal(body, &tasks); err != nil {
		return nil, fmt.Errorf("error parsing JSON from %s: %w", path, err)
	}

	return tasks, nil
}
