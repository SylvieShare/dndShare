package store

import (
	"context"
	"crypto/sha256"
	"embed"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema/*.sql
var schemaFiles embed.FS

type schemaPart struct {
	name string
	sql  string
}

var schemaParts = loadSchemaParts()

func loadSchemaParts() []schemaPart {
	entries, err := schemaFiles.ReadDir("schema")
	if err != nil {
		panic(err)
	}
	parts := make([]schemaPart, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		data, err := schemaFiles.ReadFile("schema/" + entry.Name())
		if err != nil {
			panic(err)
		}
		parts = append(parts, schemaPart{strings.TrimSuffix(entry.Name(), ".sql"), string(data)})
	}
	return parts
}

const schemaMigrationLockID = int64(0x444e445348415245)

func schemaChecksum(sql string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(sql)))
}

func schemaPartApplied(ctx context.Context, tx pgx.Tx, part schemaPart) (bool, error) {
	var checksum string
	err := tx.QueryRow(ctx, `SELECT checksum FROM dndshare.schema_migration WHERE code=$1`, part.name).Scan(&checksum)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if checksum != schemaChecksum(part.sql) {
		return false, fmt.Errorf("schema migration %s changed after it was applied", part.name)
	}
	return true, nil
}

func recordSchemaPart(ctx context.Context, tx pgx.Tx, part schemaPart) error {
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.schema_migration (code,checksum) VALUES ($1,$2)`,
		part.name, schemaChecksum(part.sql))
	return err
}

func applySchema(ctx context.Context, pool *pgxpool.Pool) error {
	for _, part := range schemaParts {
		if err := validateSchemaDDL(part.sql); err != nil {
			return fmt.Errorf("schema migration %s: %w", part.name, err)
		}
	}
	if err := validateStructuralBaseline(); err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, schemaMigrationLockID); err != nil {
		return fmt.Errorf("lock schema migrations: %w", err)
	}
	var existing bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('dndshare.users') IS NOT NULL`).Scan(&existing); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS dndshare;
 CREATE TABLE IF NOT EXISTS dndshare.schema_migration (
 code text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now() NOT NULL
 )`); err != nil {
		return fmt.Errorf("create schema migration ledger: %w", err)
	}
	if existing {
		if err := adoptStructuralBaseline(ctx, tx); err != nil {
			return err
		}
	}
	for _, part := range schemaParts {
		applied, err := schemaPartApplied(ctx, tx, part)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		if _, err := tx.Exec(ctx, part.sql); err != nil {
			return fmt.Errorf("apply schema migration %s: %w", part.name, err)
		}
		if err := recordSchemaPart(ctx, tx, part); err != nil {
			return fmt.Errorf("record schema migration %s: %w", part.name, err)
		}
	}
	return tx.Commit(ctx)
}
