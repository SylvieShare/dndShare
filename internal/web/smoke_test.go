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
		{"PATCH", "/api/admin-panel/error-reports/1/approval", 401},
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

	for _, name := range []string{
		"error_reports_list",
		"error_report_delete",
		"error_report_screenshot",
		"error_report_lock_acquire",
		"error_report_lock_renew",
		"error_report_lock_release",
		"error_reports_claim",
		"error_report_title_set",
	} {
		if !found[name] {
			raw, _ := json.Marshal(definitions)
			t.Fatalf("MCP tool %q is missing from %s", name, raw)
		}
	}
}

func TestMCPErrorReportListSupportsCompactProbe(t *testing.T) {
	for _, definition := range mcpToolDefs() {
		if definition["name"] != "error_reports_list" {
			continue
		}
		input, _ := definition["inputSchema"].(map[string]any)
		properties, _ := input["properties"].(map[string]any)
		summaryOnly, _ := properties["summaryOnly"].(map[string]any)
		if summaryOnly["type"] != "boolean" {
			t.Fatalf("summaryOnly must be a boolean property: %#v", summaryOnly)
		}
		return
	}
	t.Fatal("error_reports_list definition not found")
}
