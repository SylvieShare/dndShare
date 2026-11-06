// Explicit, idempotent catalogue maintenance. Preview by default.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"dndshare/internal/config"
	"github.com/jackc/pgx/v5"
)

func main() {
	apply := flag.Bool("apply", false, "commit the verified public catalogue cleanup")
	flag.Parse()
	if err := run(*apply); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(apply bool) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	connection, err := pgx.ParseConfig(cfg.DSN)
	if err != nil {
		return err
	}
	connection.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	db, err := pgx.ConnectConfig(ctx, connection)
	if err != nil {
		return err
	}
	defer db.Close(ctx)
	tx, err := db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var other bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item
		WHERE type_id=5 AND NOT deleted AND (hidden OR user_id IS NOT NULL) AND coalesce(data->>'upper','') <> '')`).Scan(&other); err != nil {
		return err
	}
	if other {
		return fmt.Errorf("unreviewed spell text outside the public catalogue: preserve it before changing printing")
	}
	var reviews map[int64]spellText
	if err := json.Unmarshal(spellReview, &reviews); err != nil {
		return err
	}
	query := `SELECT id,type_id,data FROM dndshare.item WHERE user_id IS NULL AND NOT hidden AND NOT deleted AND
	    ((type_id=1 AND (data @? '$.attacks[*].v' OR data @? '$.universe_attacks[*].v'))
	     OR (type_id=5 AND data ? 'upper') OR (type_id=10 AND data ? 'consumable')) ORDER BY id`
	if apply {
		query += " FOR UPDATE"
	}
	rows, err := tx.Query(ctx, query)
	if err != nil {
		return err
	}
	type edit struct {
		id   int64
		data json.RawMessage
	}
	var edits []edit
	var total cleanupCounts
	for rows.Next() {
		var id int64
		var kind int
		var raw json.RawMessage
		if err := rows.Scan(&id, &kind, &raw); err != nil {
			rows.Close()
			return err
		}
		next, counts, err := cleanRecord(id, kind, raw, reviews)
		if err != nil {
			rows.Close()
			return fmt.Errorf("item %d: %w", id, err)
		}
		if counts != (cleanupCounts{}) {
			edits = append(edits, edit{id, next})
			total.weapon += counts.weapon
			total.spells += counts.spells
			total.potions += counts.potions
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if apply {
		for _, edit := range edits {
			if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET data=$1::jsonb,changed_at=now() WHERE id=$2`, string(edit.data), edit.id); err != nil {
				return err
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("apply=%t items=%d weapon_formulas=%d spell_texts=%d potion_flags=%d\n", apply, len(edits), total.weapon, total.spells, total.potions)
	return nil
}
