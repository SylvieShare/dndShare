package web

import (
	"net/http/httptest"
	"testing"

	"dndshare/internal/config"
)

func TestSessionCookiesPersistForThirtyDays(t *testing.T) {
	s := New(config.Config{SecureCookie: "false"}, nil, nil)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/api/user/auth", nil)

	s.setSessionCookies(recorder, request, 42, "00000000-0000-4000-8000-000000000000")

	cookies := recorder.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("want 2 session cookies, got %d", len(cookies))
	}
	for _, cookie := range cookies {
		if cookie.MaxAge != sessionCookieMaxAge {
			t.Errorf("cookie %q MaxAge: want %d, got %d", cookie.Name, sessionCookieMaxAge, cookie.MaxAge)
		}
		if !cookie.HttpOnly {
			t.Errorf("cookie %q must remain HttpOnly", cookie.Name)
		}
	}
}

func TestClearedSessionCookiesExpireImmediately(t *testing.T) {
	s := New(config.Config{SecureCookie: "false"}, nil, nil)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/api/user/logout", nil)

	s.clearSessionCookies(recorder, request)

	for _, cookie := range recorder.Result().Cookies() {
		if cookie.MaxAge != -1 {
			t.Errorf("cookie %q MaxAge: want -1, got %d", cookie.Name, cookie.MaxAge)
		}
	}
}
