package web

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const maxAuthRateLimitKeys = 10_000

type authRateWindow struct {
	count int
	reset time.Time
}

type authRateLimiter struct {
	mu      sync.Mutex
	windows map[string]authRateWindow
}

func newAuthRateLimiter() *authRateLimiter {
	return &authRateLimiter{windows: make(map[string]authRateWindow)}
}

func (l *authRateLimiter) allow(key string, limit int, window time.Duration, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	current, exists := l.windows[key]
	if !exists || !now.Before(current.reset) {
		if len(l.windows) >= maxAuthRateLimitKeys {
			for candidate, value := range l.windows {
				if !now.Before(value.reset) {
					delete(l.windows, candidate)
				}
			}
		}
		if len(l.windows) >= maxAuthRateLimitKeys {
			return false, window
		}
		l.windows[key] = authRateWindow{count: 1, reset: now.Add(window)}
		return true, 0
	}
	if current.count >= limit {
		return false, current.reset.Sub(now)
	}
	current.count++
	l.windows[key] = current
	return true, 0
}

func (l *authRateLimiter) reset(key string) {
	l.mu.Lock()
	delete(l.windows, key)
	l.mu.Unlock()
}

func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustProxyHeaders {
		if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); net.ParseIP(forwarded) != nil {
			return forwarded
		}
		if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(realIP) != nil {
			return realIP
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
