package store

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testSpellDamageTypeChoices(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE dndshare.item_type SET fields='[{"key":"damage","fields":[{"key":"dices"}]},{"key":"rolls","fields":[{"key":"label"}]},{"key":"heal","fields":[{"key":"dices"}]}]' WHERE id=5`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err = tx.Exec(ctx, schemaSpellDamageTypeChoicesSQL); err != nil {
			t.Fatal(err)
		}
		var valid bool
		err = tx.QueryRow(ctx, `SELECT fields#>>'{0,fields,0,key}'='type_choices' AND fields#>>'{0,fields,0,suggest_id}'='12' AND jsonb_array_length(fields#>'{0,fields}')=2 AND fields#>>'{1,fields,0,key}'='type_choices' AND jsonb_array_length(fields#>'{1,fields}')=2 AND fields#>'{2,fields}'='[{"key":"dices"}]'::jsonb FROM dndshare.item_type WHERE id=5`).Scan(&valid)
		if err != nil || !valid {
			t.Fatalf("pass %d: valid=%v, error=%v", i, valid, err)
		}
	}
}
