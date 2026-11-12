package web

import (
	"dndshare/internal/config"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBuildInfoWorksWithoutDatabaseAndWithStaleClient(t *testing.T) {
	handler := New(config.Config{}, nil, nil).Handler()
	request := httptest.NewRequest(http.MethodGet, "/api/build-info", nil)
	request.AddCookie(&http.Cookie{Name: cookieSessionID, Value: "42"})
	request.AddCookie(&http.Cookie{Name: cookieSessionUUID, Value: "old-session"})
	request.Header.Set("X-DnDShare-Client-Api", "999")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatalf("metadata requires database or current client: %d %s", response.Code, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("metadata can become stale")
	}
	var body struct {
		Backend struct {
			Version     string `json:"version"`
			APIContract int    `json:"apiContract"`
		} `json:"backend"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Backend.Version == "" || body.Backend.APIContract != 1 {
		t.Fatalf("invalid metadata: %s", response.Body.String())
	}
}
func TestClientContractStopsIncompatibleMutationsBeforeAuthentication(t *testing.T) {
	handler := New(config.Config{}, nil, nil).Handler()
	for _, item := range []struct {
		header string
		status int
	}{{"999", 426}, {"1", 404}, {"", 404}} {
		request := httptest.NewRequest(http.MethodPost, "/api/no-such-operation", nil)
		request.Header.Set("X-DnDShare-Client-Api", item.header)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != item.status {
			t.Fatalf("client %q: got %d", item.header, response.Code)
		}
	}
}
