package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// PHB 2014, Combat / Melee Attacks. Only the inspected damage row is eligible.
func normalizeUnarmed(ctx context.Context, tx pgx.Tx, apply bool) error {
	const oldRow = `[{"v":"1","type":3,"count":1,"dice_id":"d4"}]`
	const canonical = `[{"type":3,"count":1}]`
	const record = ` FROM dndshare.item i WHERE i.id=64 AND i.user_id IS NULL AND i.type_id=1
 AND i.name='Безоружный удар' AND EXISTS (
 SELECT 1 FROM dndshare.item_version_compatibility c
 WHERE c.item_id=i.id AND c.source_version_id=1 AND c.status='native')`
	var needsChange, alreadyDone bool
	if err := tx.QueryRow(ctx, "SELECT data->'attacks'=$1::jsonb, data->'attacks'=$2::jsonb"+record+" FOR UPDATE", oldRow, canonical).Scan(&needsChange, &alreadyDone); err != nil {
		return err
	}
	if !needsChange && !alreadyDone {
		return fmt.Errorf("record 64 has changed, review the damage before applying")
	}
	if apply && needsChange {
		if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET data=jsonb_set(data,'{attacks}',$1::jsonb),changed_at=now() WHERE id=64`, canonical); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("unarmed strike 2014: apply=%t changed=%t\n", apply, needsChange)
	return nil
}
