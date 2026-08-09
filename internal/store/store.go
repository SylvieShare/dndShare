package store

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

// ErrNotFound — строки нет (аналог возврата null / Optional.empty у репозиториев).
var ErrNotFound = errors.New("not found")

// Store — доступ к Postgres поверх пула pgx. Методы по фичам разложены по отдельным
// файлам этого пакета (users.go, characters.go, handbook.go, ...).
type Store struct {
	pool *pgxpool.Pool
}

// Open создаёт пул и накатывает идемпотентную схему.
// Simple-протокол — чтобы работать через пулер YC (порт 6432, transaction pooling).
func Open(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}

	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// Ping verifies that the database is reachable for readiness checks.
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// IsUniqueViolation — ошибка нарушения уникального ограничения (SQLSTATE 23505).
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
