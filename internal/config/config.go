package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Config — конфигурация приложения из env.
type Config struct {
	Environment       string
	Port              string
	DSN               string
	SecureCookie      string // auto | true | false
	DevOrigin         string // CORS-origin для vite (локальная разработка)
	TrustProxyHeaders bool

	MCPAuthToken    string
	MCPWriteEnabled bool

	Storage StorageConfig
}

// StorageConfig — S3-совместимое объектное хранилище (Yandex Object Storage).
type StorageConfig struct {
	Endpoint  string
	Region    string
	Bucket    string
	PublicURL string
	AccessKey string
	SecretKey string
	KeyPrefix string
}

// Load читает актуальный environment contract приложения.
func Load() (Config, error) {
	environment := strings.ToLower(env("APP_ENV", "development"))
	dbPassword := env("DB_PASSWORD", "changeme")
	dsn, err := buildDSN(
		env("DB_URL", "jdbc:postgresql://localhost:5432/sylvieshare"),
		env("DB_USER", "sylvie"),
		dbPassword,
	)
	if err != nil {
		return Config{}, err
	}
	mcpWriteEnabled, err := envBool("MCP_WRITE_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	trustProxyHeaders, err := envBool("TRUST_PROXY_HEADERS", false)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		Environment:       environment,
		Port:              env("PORT", "8080"),
		DSN:               dsn,
		SecureCookie:      strings.ToLower(env("SESSION_SECURE_COOKIE", "auto")),
		DevOrigin:         "http://localhost:5173",
		TrustProxyHeaders: trustProxyHeaders,

		MCPAuthToken:    env("MCP_AUTH_TOKEN", "dev-mcp-token-change-me"),
		MCPWriteEnabled: mcpWriteEnabled,

		Storage: StorageConfig{
			Endpoint:  env("OBJECT_STORAGE_ENDPOINT", "https://storage.yandexcloud.net"),
			Region:    env("OBJECT_STORAGE_REGION", "ru-central1"),
			Bucket:    env("OBJECT_STORAGE_BUCKET", "dndshare"),
			PublicURL: env("OBJECT_STORAGE_PUBLIC_URL", "https://storage.yandexcloud.net/dndshare"),
			AccessKey: env("OBJECT_STORAGE_ACCESS_KEY", ""),
			SecretKey: env("OBJECT_STORAGE_SECRET_KEY", ""),
			KeyPrefix: env("OBJECT_STORAGE_KEY_PREFIX", "images/"),
		},
	}
	if err := cfg.validate(dbPassword); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate(dbPassword string) error {
	switch c.Environment {
	case "development", "test", "production":
	default:
		return fmt.Errorf("bad APP_ENV %q: want development, test or production", c.Environment)
	}
	switch c.SecureCookie {
	case "auto", "true", "false":
	default:
		return fmt.Errorf("bad SESSION_SECURE_COOKIE %q: want auto, true or false", c.SecureCookie)
	}
	if c.Environment != "production" {
		return nil
	}
	if dbPassword == "" || dbPassword == "changeme" {
		return fmt.Errorf("DB_PASSWORD must be set to a non-default value in production")
	}
	if c.MCPAuthToken == "" || c.MCPAuthToken == "dev-mcp-token-change-me" {
		return fmt.Errorf("MCP_AUTH_TOKEN must be set to a non-default value in production")
	}
	if c.Storage.AccessKey == "" || c.Storage.SecretKey == "" {
		return fmt.Errorf("object storage credentials must be set in production")
	}
	if c.SecureCookie == "false" {
		return fmt.Errorf("SESSION_SECURE_COOKIE=false is not allowed in production")
	}
	return nil
}

// buildDSN превращает JDBC-URL + user/password в DSN для pgx.
// jdbc:postgresql://host:6432/db  ->  postgresql://user:pass@host:6432/db
func buildDSN(jdbcURL, user, password string) (string, error) {
	raw := strings.TrimPrefix(jdbcURL, "jdbc:")
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("bad DB_URL %q: %w", jdbcURL, err)
	}
	if u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("bad DB_URL %q: need scheme and host", jdbcURL)
	}
	u.User = url.UserPassword(user, password)
	return u.String(), nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// envBool читает булев env (true/1/yes и т.п. через strconv.ParseBool).
func envBool(key string, def bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	b, err := strconv.ParseBool(strings.TrimSpace(v))
	if err != nil {
		return false, fmt.Errorf("bad %s %q: %w", key, v, err)
	}
	return b, nil
}
