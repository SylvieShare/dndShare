// Package testdb gives each PostgreSQL test its own disposable database.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DSN creates a database, never reusing or clearing the supplied parent database.
// The database profile sets DNDSHARE_TEST_REQUIRED so missing configuration fails.
func DSN(t testing.TB) string {
	t.Helper()
	dsn := os.Getenv("DNDSHARE_TEST_DSN")
	if dsn == "" {
		if os.Getenv("DNDSHARE_TEST_REQUIRED") == "1" {
			t.Fatal("database tests require DNDSHARE_TEST_DSN; run python3 scripts/test.py db")
		}
		t.Skip("PostgreSQL: run python3 scripts/test.py db")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Host != "127.0.0.1" || !strings.HasPrefix(cfg.Database, "dndshare_test_") {
		t.Fatal("DNDSHARE_TEST_DSN must target a local 127.0.0.1/dndshare_test_* parent database")
	}
	for _, fallback := range cfg.Fallbacks {
		if fallback.Host != "127.0.0.1" {
			t.Fatal("test database fallbacks must stay on 127.0.0.1")
		}
	}
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	connectionURL, err := url.Parse(dsn)
	if err != nil || (connectionURL.Scheme != "postgres" && connectionURL.Scheme != "postgresql") {
		t.Fatal("DNDSHARE_TEST_DSN must be a postgres:// URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	admin, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	var suffix [12]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		admin.Close(ctx)
		t.Fatal(err)
	}
	name := "dndshare_test_" + hex.EncodeToString(suffix[:])
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()+" TEMPLATE template0"); err != nil {
		admin.Close(ctx)
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		defer admin.Close(ctx)
		if _, err := admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)"); err != nil {
			t.Errorf("remove isolated test database: %v", err)
		}
	})
	connectionURL.Path = "/" + name
	query := connectionURL.Query()
	query.Del("dbname")
	connectionURL.RawQuery = query.Encode()
	return connectionURL.String()
}

// Pool registers cleanup after the database cleanup, so connections close first.
func Pool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	cfg, err := pgxpool.ParseConfig(DSN(t))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}
