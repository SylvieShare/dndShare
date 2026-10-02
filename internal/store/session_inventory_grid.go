package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// Serializes placement across additions, returns and grid moves without changing character lock order.
func lockInventoryLayout(ctx context.Context, tx pgx.Tx, sessionID int64) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('inventory:' || $1::bigint::text, 0))`, sessionID)
	return err
}

func freeInventorySlot(ctx context.Context, tx pgx.Tx, sessionID int64) (int, error) {
	if err := lockInventoryLayout(ctx, tx, sessionID); err != nil {
		return 0, err
	}
	var slot int
	err := tx.QueryRow(ctx, `SELECT min(candidate) FROM generate_series(0,
   (SELECT count(*)::integer FROM dndshare.session_inventory WHERE session_id=$1 AND available)) candidate
   WHERE NOT EXISTS (SELECT 1 FROM dndshare.session_inventory WHERE session_id=$1 AND available AND slot=candidate)`, sessionID).Scan(&slot)
	return slot, err
}

// Expected coordinates prevent stale requests from swapping a changed destination.
// A retry after a committed move is a no-op rather than a second swap.
func (s *Store) MoveSessionInventory(ctx context.Context, sessionID, userID int64, id string, fromSlot, slot int, targetID string) error {
	if fromSlot < 0 || slot < 0 {
		return ErrApplication
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = inventoryOwner(ctx, tx, sessionID, userID); err != nil {
		return err
	}
	if err = lockInventoryLayout(ctx, tx, sessionID); err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `SELECT id::text,slot FROM dndshare.session_inventory WHERE session_id=$1 AND available ORDER BY slot FOR UPDATE`, sessionID)
	if err != nil {
		return err
	}
	current, last, lastRowCount := -1, -1, 0
	occupied := ""
	for rows.Next() {
		var entryID string
		var entrySlot int
		if err = rows.Scan(&entryID, &entrySlot); err != nil {
			rows.Close()
			return err
		}
		if entryID == id {
			current = entrySlot
		}
		if entrySlot == slot {
			occupied = entryID
		}
		if last < 0 || entrySlot/4 != last/4 {
			lastRowCount = 0
		}
		lastRowCount++
		last = entrySlot
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if current < 0 {
		return ErrItemTransferConflict
	}
	if current == slot {
		return tx.Commit(ctx)
	}
	if current != fromSlot || occupied != targetID {
		return ErrItemTransferConflict
	}
	size := (last/4 + 1) * 4
	if lastRowCount == 4 {
		size += 4
	}
	if slot >= size {
		return ErrApplication
	}
	// Temporarily release the source cell to satisfy the partial unique index during a swap.
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_inventory SET available=false WHERE session_id=$1 AND id=$2::uuid`, sessionID, id); err != nil {
		return err
	}
	if occupied != "" {
		if _, err = tx.Exec(ctx, `UPDATE dndshare.session_inventory SET slot=$3 WHERE session_id=$1 AND id=$2::uuid`, sessionID, occupied, current); err != nil {
			return err
		}
	}
	tag, err := tx.Exec(ctx, `UPDATE dndshare.session_inventory SET slot=$3,available=true WHERE session_id=$1 AND id=$2::uuid`, sessionID, id, slot)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return errors.New("inventory entry disappeared while locked")
	}
	return tx.Commit(ctx)
}
