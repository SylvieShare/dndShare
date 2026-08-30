package web

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestRecovererDoesNotExposePanicDetails(t *testing.T) {
	originalLog := log.Writer()
	log.SetOutput(io.Discard)
	defer log.SetOutput(originalLog)
	server := &Server{}
	handler := server.recoverer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("database password is secret")
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/test", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "database password") {
		t.Fatalf("panic details leaked to the response: %s", recorder.Body.String())
	}
}

func TestNewUUIDReturnsVersionFourUUID(t *testing.T) {
	value, err := newUUID()
	if err != nil {
		t.Fatal(err)
	}
	if len(value) != 36 || value[14] != '4' || (value[19] != '8' && value[19] != '9' && value[19] != 'a' && value[19] != 'b') {
		t.Fatalf("unexpected UUIDv4 %q", value)
	}
}

func TestClearedSessionCookiesExpireImmediately(t *testing.T) {
	s := New(config.Config{SecureCookie: "false"}, nil, nil)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/api/user/logout", nil)

	s.clearSessionCookies(recorder, request)

	for _, cookie := range recorder.Result().Cookies() {
		if cookie.MaxAge != -1 {
			t.Errorf("cookie %q MaxAge: want -1, got %d", cookie.Name, cookie.MaxAge)
		}
	}
}
