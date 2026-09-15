package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSessionSettingsRequireAuthentication(t *testing.T) {
	s := &Server{}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/api/sessions/00000000-0000-4000-8000-000000000001/settings", strings.NewReader(`{"key":"playersSeeHp","value":true}`))
	s.handleUpdateSessionSetting(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", w.Code)
	}
}
