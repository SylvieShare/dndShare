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
	Port         string
	DSN          string
	SecureCookie string // auto | true | false
	DevOrigin    string // CORS-origin для vite (локальная разработка)

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
	dsn, err := buildDSN(
		env("DB_URL", "jdbc:postgresql://localhost:5432/sylvieshare"),
		env("DB_USER", "sylvie"),
		env("DB_PASSWORD", "changeme"),
	)
	if err != nil {
		return Config{}, err
	}
	return Config{
		Port:         env("PORT", "8080"),
		DSN:          dsn,
		SecureCookie: strings.ToLower(env("SESSION_SECURE_COOKIE", "auto")),
		DevOrigin:    "http://localhost:5173",

		MCPAuthToken:    env("MCP_AUTH_TOKEN", "dev-mcp-token-change-me"),
		MCPWriteEnabled: envBool("MCP_WRITE_ENABLED", false),

		Storage: StorageConfig{
			Endpoint:  env("OBJECT_STORAGE_ENDPOINT", "https://storage.yandexcloud.net"),
			Region:    env("OBJECT_STORAGE_REGION", "ru-central1"),
			Bucket:    env("OBJECT_STORAGE_BUCKET", "dndshare"),
			PublicURL: env("OBJECT_STORAGE_PUBLIC_URL", "https://storage.yandexcloud.net/dndshare"),
			AccessKey: env("OBJECT_STORAGE_ACCESS_KEY", ""),
			SecretKey: env("OBJECT_STORAGE_SECRET_KEY", ""),
			KeyPrefix: env("OBJECT_STORAGE_KEY_PREFIX", "images/"),
		},
	}, nil
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

// envBool читает булев env (true/1/yes и т.п. через strconv.ParseBool); пусто/битое → def.
func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(strings.TrimSpace(v))
	if err != nil {
		return def
	}
	return b
}
