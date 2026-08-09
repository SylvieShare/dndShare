package web

import (
	"encoding/json"
	"net/http/httptest"
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
		{"POST", "/mcp", 401},
		{"POST", "/api/error-reports", 400},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, nil))
		if rec.Code != c.want {
			t.Fatalf("%s %s: want %d, got %d", c.method, c.path, c.want, rec.Code)
		}
	}
}

func TestMCPPublishesErrorReportTools(t *testing.T) {
	definitions := mcpToolDefs()
	found := map[string]bool{}
	for _, definition := range definitions {
		name, _ := definition["name"].(string)
		found[name] = true
	}

	for _, name := range []string{"error_reports_list", "error_report_delete", "error_report_screenshot"} {
		if !found[name] {
			raw, _ := json.Marshal(definitions)
			t.Fatalf("MCP tool %q is missing from %s", name, raw)
		}
	}
}
