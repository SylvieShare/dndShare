package store

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func validateSpellCastTarget(ctx context.Context, tx pgx.Tx, p ApplicationPlan, t ItemTransfer, target ApplicationTarget, destination int64) error {
	if p.CastID == "" || !t.AddressedToDM {
		return nil
	}
	var duplicate bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item_transfer other WHERE other.id<>$2 AND other.application->>'castId'=$1 AND other.status IN ('pending','accepted') AND (
 ($3>0 AND (other.recipient_char_id=$3 OR (other.status='accepted' AND (other.resolved_target->>'charId')::bigint=$3)))
 OR ($4<>'' AND other.status='accepted' AND other.resolved_target->>'npcUid'=$4 AND (other.resolved_target->>'encounterId')::bigint=$5)))
 OR EXISTS(SELECT 1 FROM dndshare.spell_cast_receipt WHERE cast_id=$1::uuid AND char_id=$3 AND request->'targets' ? 'self')`, p.CastID, t.ID, destination, target.NPCUID, target.EncounterID).Scan(&duplicate)
	if err != nil {
		return err
	}
	if duplicate {
		return fmt.Errorf("%w: эта цель уже выбрана для данного заклинания", ErrApplication)
	}
	return nil
}
