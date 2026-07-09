package web

import (
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
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, nil))
		if rec.Code != c.want {
			t.Fatalf("%s %s: want %d, got %d", c.method, c.path, c.want, rec.Code)
		}
	}
}
