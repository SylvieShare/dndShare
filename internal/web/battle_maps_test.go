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
	s.routesMapModels(mux)
	s.routesMapModelEditing(mux)
	s.routesMapPreviews(mux)
	for _, route := range []string{
		"GET /api/maps", "POST /api/maps", "PUT /api/maps/system-dungeon", "DELETE /api/maps/system-dungeon",
		"GET /api/sessions/test/maps", "POST /api/sessions/test/maps", "PUT /api/sessions/test/maps/test-map",
		"DELETE /api/sessions/test/maps/test-map", "PUT /api/sessions/test/map-display", "GET /api/sessions/test/map-events",
		"GET /api/maps/models", "GET /api/maps/models/test/render", "PUT /api/maps/models/test",
		"GET /api/maps/test/preview-context", "GET /api/maps/test/preview", "POST /api/maps/test/preview",
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
	mux.HandleFunc("PUT /api/maps/{mapId}", s.handleSaveMap)
	mux.HandleFunc("DELETE /api/maps/{mapId}", s.handleDeleteMap)
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

func TestMapUserAccessDoesNotRequireRoles(t *testing.T) {
	// There is no store: any role lookup would fail instead of reaching the handler.
	s := &Server{}
	handler := s.mapUserOnly(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := mustUser(w, r)
		if !ok || uid != 42 {
			t.Fatal("authenticated user not passed through")
		}
		w.WriteHeader(http.StatusNoContent)
	})
	r := httptest.NewRequest("GET", "/api/maps/models", nil)
	r = r.WithContext(context.WithValue(r.Context(), userIDKey, int64(42)))
	w := httptest.NewRecorder()
	handler(w, r)
	if w.Code != http.StatusNoContent {
		t.Fatalf("got %d: %s", w.Code, w.Body.String())
	}
}

func TestNonAdminMapRoutesReachTheirValidation(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesBattleMaps(mux)
	s.routesMapModels(mux)
	s.routesMapPreviews(mux)
	for _, route := range []string{
		"POST /api/maps", "PUT /api/maps/invalid", "DELETE /api/maps/invalid",
		"GET /api/sessions/invalid/maps", "POST /api/sessions/invalid/maps",
		"PUT /api/sessions/invalid/maps/invalid", "DELETE /api/sessions/invalid/maps/invalid",
		"PUT /api/sessions/invalid/map-display", "GET /api/sessions/invalid/map-events",
		"GET /api/maps/models/invalid/render", "GET /api/maps/invalid/preview-context",
		"GET /api/maps/invalid/preview", "POST /api/maps/invalid/preview",
	} {
		t.Run(route, func(t *testing.T) {
			method, path, _ := strings.Cut(route, " ")
			r := httptest.NewRequest(method, path, nil)
			r = r.WithContext(context.WithValue(r.Context(), userIDKey, int64(42)))
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != http.StatusBadRequest && w.Code != http.StatusNotFound {
				t.Fatalf("got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}
