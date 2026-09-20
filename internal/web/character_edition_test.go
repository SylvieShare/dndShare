package web

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestChangeCharacterEditionRequestGuards(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesCharacterEdition(mux)
	for _, tc := range []struct {
		name, body    string
		authenticated bool
		status        int
	}{
		{"anonymous", `{"sourceVersionId":2,"version":0,"confirmed":true}`, false, http.StatusUnauthorized},
		{"missing confirmation", `{"sourceVersionId":2,"version":0}`, true, http.StatusBadRequest},
		{"missing revision", `{"sourceVersionId":2,"confirmed":true}`, true, http.StatusBadRequest},
		{"negative revision", `{"sourceVersionId":2,"version":-1,"confirmed":true}`, true, http.StatusBadRequest},
		{"missing target", `{"version":0,"confirmed":true}`, true, http.StatusBadRequest},
		{"invalid JSON", `{`, true, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPut, "/api/char/test/edition", strings.NewReader(tc.body))
			if tc.authenticated {
				request = request.WithContext(context.WithValue(request.Context(), userIDKey, int64(101)))
			}
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("got %d, want %d: %s", response.Code, tc.status, response.Body.String())
			}
		})
	}
}
