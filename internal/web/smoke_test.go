package web

import (
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/config"
)

func TestHandlerRegistersAllRoutesWithoutConflict(t *testing.T) {
	// given
	s := New(config.Config{SecureCookie: "false"}, nil, nil)

	// when
	h := s.Handler()

	// then
	cases := []struct {
		method string
		path   string
		want   int
	}{
		{"GET", "/some/spa/route", 200},
		{"GET", "/ping", 200},
		{"GET", "/api/user/logout", 405},
		{"POST", "/api/user/logout", 200},
		{"POST", "/mcp", 401},
		{"POST", "/api/error-reports", 404},
		{"PATCH", "/api/admin-panel/error-reports/1/approval", 404},
		{"PATCH", "/api/sessions/00000000-0000-0000-0000-000000000000/participants-order", 401},
		{"POST", "/api/char/00000000-0000-0000-0000-000000000000/icon-image", 401},
		{"DELETE", "/api/char/00000000-0000-0000-0000-000000000000/icon-image", 401},
		{"PATCH", "/api/sessions/00000000-0000-0000-0000-000000000000/graph-nodes/positions", 401},
		{"POST", "/api/sessions/00000000-0000-0000-0000-000000000000/graph-nodes/delete", 401},
		{"GET", "/api/public/sessions/not-a-uuid/presentation/events", 404},
		{"GET", "/api/public/sessions/not-a-uuid/presentation/music", 404},
		{"GET", "/api/sessions/00000000-0000-0000-0000-000000000000/presentation-connections", 401},
		{"GET", "/api/sessions/00000000-0000-0000-0000-000000000000/live", 401},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, nil))
		if rec.Code != c.want {
			t.Fatalf("%s %s: want %d, got %d", c.method, c.path, c.want, rec.Code)
		}
	}
}

func TestMCPDoesNotPublishErrorReportTools(t *testing.T) {
	for _, definition := range mcpToolDefs() {
		name, _ := definition["name"].(string)
		if strings.HasPrefix(name, "error_report") {
			t.Fatalf("removed tool still published: %s", name)
		}
	}
}

func TestStructuredMCPToolResultKeepsJSONTextAndTypedValue(t *testing.T) {
	value := map[string]any{
		"id":       int64(42),
		"released": true,
	}

	result, err := newStructuredMCPToolResult(value)
	if err != nil {
		t.Fatalf("newStructuredMCPToolResult: %v", err)
	}
	if len(result.Content) != 1 || result.Content[0].Text != `{"id":42,"released":true}` {
		t.Fatalf("unexpected backwards-compatible text content: %#v", result.Content)
	}
	structured, ok := result.StructuredContent["result"].(map[string]any)
	if !ok {
		t.Fatalf("structured result is missing: %#v", result.StructuredContent)
	}
	if structured["id"] != int64(42) || structured["released"] != true {
		t.Fatalf("unexpected structured result: %#v", structured)
	}
}
