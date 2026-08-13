package store

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// The schema is split by domain, but remains one atomic startup migration.
// The explicit order is part of the database contract: later sections may
// reference objects and seed data created by earlier ones.

//go:embed schema/01_foundation.sql
var schemaFoundationSQL string

//go:embed schema/02_handbook.sql
var schemaHandbookSQL string

//go:embed schema/03_characters.sql
var schemaCharactersSQL string

//go:embed schema/04_sessions.sql
var schemaSessionsSQL string

//go:embed schema/05_seed.sql
var schemaSeedSQL string

//go:embed schema/06_item_icons.sql
var schemaItemIconsSQL string

var schemaParts = []struct {
	name string
	sql  string
}{
	{"foundation", schemaFoundationSQL},
	{"handbook", schemaHandbookSQL},
	{"characters", schemaCharactersSQL},
	{"sessions", schemaSessionsSQL},
	{"seed", schemaSeedSQL},
	{"item-icons", schemaItemIconsSQL},
}

func applySchema(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, part := range schemaParts {
		if _, err := tx.Exec(ctx, part.sql); err != nil {
			return fmt.Errorf("apply schema part %s: %w", part.name, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	return nil
}
