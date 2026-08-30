package web

import (
	"net/http/httptest"
	"testing"
	"time"

	"dndshare/internal/config"
)

func TestAuthRateLimiterBlocksUntilWindowExpires(t *testing.T) {
	limiter := newAuthRateLimiter()
	now := time.Date(2026, time.August, 30, 10, 0, 0, 0, time.UTC)
	for range 2 {
		if ok, _ := limiter.allow("login:user", 2, time.Minute, now); !ok {
			t.Fatal("attempt inside limit was rejected")
		}
	}
	if ok, retry := limiter.allow("login:user", 2, time.Minute, now); ok || retry <= 0 {
		t.Fatalf("attempt over limit must be rejected with retry delay, got ok=%v retry=%v", ok, retry)
	}
	if ok, _ := limiter.allow("login:user", 2, time.Minute, now.Add(time.Minute)); !ok {
		t.Fatal("new window must accept attempts")
	}
}

func TestClientIPTrustsForwardedHeaderOnlyWhenConfigured(t *testing.T) {
	request := httptest.NewRequest("POST", "/api/user/auth", nil)
	request.RemoteAddr = "127.0.0.1:12345"
	request.Header.Set("X-Forwarded-For", "203.0.113.10, 127.0.0.1")

	if got := (&Server{}).clientIP(request); got != "127.0.0.1" {
		t.Fatalf("untrusted proxy header changed client IP: %q", got)
	}
	server := &Server{cfg: config.Config{TrustProxyHeaders: true}}
	if got := server.clientIP(request); got != "203.0.113.10" {
		t.Fatalf("trusted proxy header was not used: %q", got)
	}
}
