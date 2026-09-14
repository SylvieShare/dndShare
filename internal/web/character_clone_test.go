package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCloneCharacterRequiresAuthentication(t *testing.T) {
	s := &Server{}
	response := httptest.NewRecorder()
	s.handleCloneChar(response, httptest.NewRequest(http.MethodPost, "/api/char/public/clone", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous clone: %d", response.Code)
	}
}
