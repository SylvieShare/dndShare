package store

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

// Reconstruct the pre-107 snapshot used by the ordered migration integration test.
func stripLuckBladeSchema(field map[string]any) {
	if field["key"] != "use_resources" && field["key"] != "derived_effects" && field["key"] != "roll_triggers" {
		return
	}
	var keep []any
	for _, raw := range field["fields"].([]any) {
		child := raw.(map[string]any)
		if child["key"] == "activation" || child["key"] == "initial_charges" || child["key"] == "use_key" {
			continue
		}
		if field["key"] == "roll_triggers" && child["key"] == "event" {
			var options []any
			for _, option := range child["options"].([]any) {
				if option.(map[string]any)["value"] != "any" {
					options = append(options, option)
				}
			}
			child["options"] = options
		}
		keep = append(keep, child)
	}
	field["fields"] = keep
}
func testLuckBladeMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `INSERT INTO dndshare.item(id,name,type_id,data) VALUES(171,'Клинок удачи',19,'{"desc":"keep","weapon":{"magic_bonus":1},"confirmed_uses":[{"key":"authored"}]}')`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err := pool.Exec(ctx, schemaLuckBladeRulesSQL); err != nil {
			t.Fatal(err)
		}
	}
	var valid bool
	err := pool.QueryRow(ctx, `SELECT data->>'desc'='keep' AND data->>'activation'='carried' AND data->'weapon'->>'magic_bonus'='1' AND jsonb_array_length(data->'confirmed_uses')=3 AND data->'confirmed_uses'->0->>'key'='authored' AND data#>>'{use_resources,1,initial_charges,formula}'='1к4−1' AND data#>>'{confirmed_uses,2,cooldown_dawns}'='1' AND data#>>'{roll_triggers,0,use_key}'='luck' FROM dndshare.item WHERE id=171`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("Luck Blade migration: valid=%v err=%v", valid, err)
	}
}
