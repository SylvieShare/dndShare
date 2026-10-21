package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGlobalMapEndpointsRequireAuthentication(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesGlobalMaps(mux)
	for _, endpoint := range []struct{ method, path string }{
		{"GET", "/api/sessions/test/global-maps"}, {"POST", "/api/sessions/test/global-maps"},
		{"PATCH", "/api/sessions/test/global-maps/map"}, {"GET", "/api/sessions/test/global-maps/map/changes"}, {"DELETE", "/api/sessions/test/global-maps/map"},
		{"POST", "/api/sessions/test/global-maps/map/activate"}, {"GET", "/api/sessions/test/global-map-events"},
	} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(endpoint.method, endpoint.path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatal(endpoint, rec.Code)
		}
	}
}
