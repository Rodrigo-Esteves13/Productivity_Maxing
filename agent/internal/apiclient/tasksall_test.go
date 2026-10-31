package apiclient

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"pmaxing-agent/internal/config"
)

func newTestClient(h http.HandlerFunc) (*Client, func()) {
	srv := httptest.NewServer(h)
	c := New(config.APIConfig{BaseURL: srv.URL, APIKey: "k"})
	return c, srv.Close
}

func item(id string) string {
	return fmt.Sprintf(`{"id":%q,"title":"t"}`, id)
}

func TestTasksAllMultiPage(t *testing.T) {
	c, done := newTestClient(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("paginated") != "true" || q.Get("limit") != "200" || r.Header.Get("x-api-key") != "k" {
			t.Errorf("bad request: %s", r.URL.String())
		}
		switch q.Get("cursor") {
		case "":
			fmt.Fprintf(w, `{"items":[%s,%s],"nextCursor":"c1"}`, item("a"), item("b"))
		case "c1":
			fmt.Fprintf(w, `{"items":[%s],"nextCursor":"c2"}`, item("c"))
		case "c2":
			fmt.Fprintf(w, `{"items":[%s],"nextCursor":null}`, item("d"))
		}
	})
	defer done()
	got, err := c.TasksAll(context.Background())
	if err != nil || len(got) != 4 || got[3].ID != "d" {
		t.Fatalf("got %v err %v", got, err)
	}
}

func TestTasksAllSinglePage(t *testing.T) {
	var calls int32
	c, done := newTestClient(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		fmt.Fprintf(w, `{"items":[%s],"nextCursor":null}`, item("a"))
	})
	defer done()
	got, err := c.TasksAll(context.Background())
	if err != nil || len(got) != 1 || calls != 1 {
		t.Fatalf("got %v err %v calls %d", got, err, calls)
	}
}

func TestTasksAllLegacyArray(t *testing.T) {
	c, done := newTestClient(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintf(w, `[%s,%s]`, item("a"), item("b"))
	})
	defer done()
	got, err := c.TasksAll(context.Background())
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v err %v", got, err)
	}
}

func TestTasksAllCursor400RestartsOnce(t *testing.T) {
	var firstPages int32
	c, done := newTestClient(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Query().Get("cursor") {
		case "":
			n := atomic.AddInt32(&firstPages, 1)
			fmt.Fprintf(w, `{"items":[%s],"nextCursor":"c%d"}`, item("a"), n)
		case "c1":
			w.WriteHeader(http.StatusBadRequest)
		default:
			fmt.Fprintf(w, `{"items":[%s],"nextCursor":null}`, item("b"))
		}
	})
	defer done()
	got, err := c.TasksAll(context.Background())
	if err != nil || len(got) != 2 || firstPages != 2 {
		t.Fatalf("got %v err %v firstPages %d", got, err, firstPages)
	}
}

func TestTasksAllCursor400TwiceFails(t *testing.T) {
	var firstPages int32
	c, done := newTestClient(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("cursor") == "" {
			atomic.AddInt32(&firstPages, 1)
			fmt.Fprintf(w, `{"items":[%s],"nextCursor":"x"}`, item("a"))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
	})
	defer done()
	if _, err := c.TasksAll(context.Background()); err == nil || firstPages != 2 {
		t.Fatalf("want error after one restart, err %v firstPages %d", err, firstPages)
	}
}

func TestTasksAllPageCap(t *testing.T) {
	var calls int32
	c, done := newTestClient(func(w http.ResponseWriter, _ *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		fmt.Fprintf(w, `{"items":[%s],"nextCursor":"n%d"}`, item(fmt.Sprint("id", n)), n)
	})
	defer done()
	_, err := c.TasksAll(context.Background())
	if err == nil || !strings.Contains(err.Error(), "pages") || calls != tasksMaxPages {
		t.Fatalf("err %v calls %d", err, calls)
	}
}

func TestTasksAllDedupe(t *testing.T) {
	c, done := newTestClient(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("cursor") == "" {
			fmt.Fprintf(w, `{"items":[%s,%s],"nextCursor":"c1"}`, item("a"), item("b"))
			return
		}
		fmt.Fprintf(w, `{"items":[%s,%s],"nextCursor":null}`, item("b"), item("c"))
	})
	defer done()
	got, err := c.TasksAll(context.Background())
	if err != nil || len(got) != 3 {
		t.Fatalf("got %v err %v", got, err)
	}
}

func TestTasksAllUnauthorized(t *testing.T) {
	c, done := newTestClient(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	defer done()
	if _, err := c.TasksAll(context.Background()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

func TestTasksAllContextCancelled(t *testing.T) {
	c, done := newTestClient(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"items":[],"nextCursor":null}`)
	})
	defer done()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.TasksAll(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
}
