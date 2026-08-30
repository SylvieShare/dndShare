package config

import (
	"strings"
	"testing"
)

func TestProductionRejectsDefaultSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_PASSWORD", "changeme")
	t.Setenv("MCP_AUTH_TOKEN", "dev-mcp-token-change-me")
	t.Setenv("OBJECT_STORAGE_ACCESS_KEY", "")
	t.Setenv("OBJECT_STORAGE_SECRET_KEY", "")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DB_PASSWORD") {
		t.Fatalf("production must reject the default database password, got %v", err)
	}
}

func TestProductionAcceptsExplicitSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_PASSWORD", "database-secret")
	t.Setenv("MCP_AUTH_TOKEN", "mcp-secret")
	t.Setenv("OBJECT_STORAGE_ACCESS_KEY", "storage-key")
	t.Setenv("OBJECT_STORAGE_SECRET_KEY", "storage-secret")
	t.Setenv("SESSION_SECURE_COOKIE", "auto")
	t.Setenv("TRUST_PROXY_HEADERS", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Environment != "production" || !cfg.TrustProxyHeaders {
		t.Fatalf("unexpected production config: %#v", cfg)
	}
}

func TestInvalidBooleanFailsFast(t *testing.T) {
	t.Setenv("MCP_WRITE_ENABLED", "sometimes")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "MCP_WRITE_ENABLED") {
		t.Fatalf("invalid boolean must fail fast, got %v", err)
	}
}
