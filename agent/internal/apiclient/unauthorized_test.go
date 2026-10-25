package apiclient

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"pmaxing-agent/internal/config"
)

// E-13: um 401 tem de ser distinguível de uma falha de rede.
func TestUnauthorizedIsTyped(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := New(config.APIConfig{BaseURL: srv.URL, APIKey: "revoked"})
	c.http = srv.Client()

	if _, err := c.FetchAgentConfig(context.Background()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("FetchAgentConfig: want ErrUnauthorized, got %v", err)
	}
	if _, err := c.TasksToday(context.Background()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("TasksToday: want ErrUnauthorized, got %v", err)
	}
}
