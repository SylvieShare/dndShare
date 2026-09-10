package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTreasurePoolRequiresAuthentication(t *testing.T) {
	s := &Server{}
	w := httptest.NewRecorder()
	s.handleTreasurePool(w, httptest.NewRequest(http.MethodGet, "/api/master-tools/treasure-pool", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}
}
