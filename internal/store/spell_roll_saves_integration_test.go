package store

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testSpellRollSaves(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE dndshare.item_type SET fields='[
 {"key":"damage","fields":[{"key":"dices"},{"key":"save_ability","type":"text"},{"key":"save_effect","type":"text"},{"key":"save_condition","type":"text"},{"key":"save_manual"}]},
 {"key":"rolls","fields":[{"key":"label"},{"key":"save_ability","type":"text"},{"key":"dices"}]},
 {"key":"description"}]' WHERE id=5`)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err = tx.Exec(ctx, schemaSpellRollSavesSQL); err != nil {
			t.Fatal(err)
		}
		var valid bool
		err = tx.QueryRow(ctx, `SELECT fields#>'{1,fields}'='[{"key":"label"},{"key":"save_ability","type":"text"},{"key":"dices"},{"key":"save_effect","type":"text"},{"key":"save_condition","type":"text"}]'::jsonb AND fields#>>'{2,key}'='description' FROM dndshare.item_type WHERE id=5`).Scan(&valid)
		if err != nil || !valid {
			t.Fatalf("migration pass %d: valid %v, error %v", i, valid, err)
		}
	}
}
