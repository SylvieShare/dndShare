package web

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPrivateMapRoutesRequireAuthentication(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesBattleMaps(mux)
	for _, route := range []string{
		"GET /api/maps", "POST /api/maps", "PUT /api/maps/system-dungeon", "DELETE /api/maps/system-dungeon",
		"GET /api/sessions/test/maps", "POST /api/sessions/test/maps", "PUT /api/sessions/test/maps/test-map",
		"DELETE /api/sessions/test/maps/test-map", "PUT /api/sessions/test/map-display", "GET /api/sessions/test/map-events",
	} {
		t.Run(route, func(t *testing.T) {
			method, path, _ := strings.Cut(route, " ")
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest(method, path, nil))
			if w.Code != http.StatusUnauthorized {
				t.Fatalf("got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestSystemMapCannotBeOverwrittenOrDeleted(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesBattleMaps(mux)
	for _, method := range []string{"PUT", "DELETE"} {
		r := httptest.NewRequest(method, "/api/maps/system-dungeon", strings.NewReader(`{"name":"replacement"}`))
		r = r.WithContext(context.WithValue(r.Context(), userIDKey, int64(1)))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != http.StatusBadRequest && w.Code != http.StatusNotFound {
			t.Fatalf("%s got %d", method, w.Code)
		}
	}
}
