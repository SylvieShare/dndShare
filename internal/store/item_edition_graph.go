package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Visibility and ownership edits must preserve the same graph invariants as
// compatibility edits. Existing character references remain readable by ID.
func validateItemEditionGraph(ctx context.Context, tx pgx.Tx, id int64) error {
	var invalid bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(
 SELECT 1 FROM dndshare.item i JOIN dndshare.item_version_compatibility c ON c.replaced_by_item_id=i.id WHERE i.id=$1 AND i.hidden
 UNION ALL
 SELECT 1 FROM dndshare.item i JOIN dndshare.item p ON p.id=i.derived_from_item_id WHERE i.id=$1 AND p.user_id IS NOT NULL AND p.user_id IS DISTINCT FROM i.user_id
 UNION ALL
 SELECT 1 FROM dndshare.item i JOIN dndshare.item_version_compatibility c ON c.item_id=i.id JOIN dndshare.item r ON r.id=c.replaced_by_item_id WHERE i.id=$1 AND r.user_id IS NOT NULL AND r.user_id IS DISTINCT FROM i.user_id
 )`, id).Scan(&invalid)
	if err != nil {
		return err
	}
	if invalid {
		return &RulesValidationError{Message: "Изменение скрывает используемую замену или делает личную зависимость недоступной"}
	}
	rows, err := tx.Query(ctx, `SELECT id FROM dndshare.item WHERE id=$1 OR parent_id=$1`, id)
	if err != nil {
		return err
	}
	ids := []int64{}
	for rows.Next() {
		var child int64
		if err = rows.Scan(&child); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, child)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	return validateParentEditions(ctx, tx, ids)
}
