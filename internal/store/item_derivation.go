package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

func setItemDerivation(ctx context.Context, tx pgx.Tx, id int64, p ItemMetadataPatch) error {
	if p.DerivedFromItemID == nil {
		return nil
	}
	if *p.DerivedFromItemID <= 0 || p.DerivationKind == nil || (*p.DerivationKind != "revision" && *p.DerivationKind != "adaptation") {
		return &RulesValidationError{Message: "Укажите исходную запись и тип варианта"}
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return err
	}
	var valid bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i JOIN dndshare.item original ON original.id=$2 WHERE i.id=$1 AND i.type_id=original.type_id AND i.id<>original.id AND (original.user_id IS NULL OR original.user_id=i.user_id))`, id, *p.DerivedFromItemID).Scan(&valid); err != nil {
		return err
	}
	if !valid {
		return &RulesValidationError{Message: "Исходная запись недоступна или имеет другой тип"}
	}
	var cycle bool
	if err := tx.QueryRow(ctx, `WITH RECURSIVE origins(id,path) AS (SELECT $2::bigint,ARRAY[$2::bigint] UNION ALL SELECT i.derived_from_item_id,path||i.derived_from_item_id FROM origins o JOIN dndshare.item i ON i.id=o.id WHERE i.derived_from_item_id IS NOT NULL AND NOT i.derived_from_item_id=ANY(path)) SELECT EXISTS(SELECT 1 FROM origins WHERE id=$1)`, id, *p.DerivedFromItemID).Scan(&cycle); err != nil {
		return err
	}
	if cycle {
		return &RulesValidationError{Message: "Варианты образуют цикл"}
	}
	_, err := tx.Exec(ctx, `UPDATE dndshare.item SET derived_from_item_id=$2,derivation_kind=$3 WHERE id=$1`, id, *p.DerivedFromItemID, *p.DerivationKind)
	return err
}
