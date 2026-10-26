package store

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Narrow store fixtures assemble only the tables they exercise. Apply the
// current structural read boundary after those tables/columns exist.
func installActiveItemFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(t.Context(), `ALTER TABLE dndshare.item
 ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS changed_at timestamptz NOT NULL DEFAULT now();
 CREATE OR REPLACE VIEW dndshare.active_item AS SELECT * FROM dndshare.item WHERE NOT deleted;`)
	if err != nil {
		t.Fatal(err)
	}
}
