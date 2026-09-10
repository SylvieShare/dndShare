package store

import (
	"context"
	"errors"
	"slices"

	"github.com/jackc/pgx/v5"
)

var ErrJournalOrderConflict = errors.New("journal order has changed")

func (s *Store) ReorderJournalEntries(ctx context.Context, journalID, sectionID, userID int64, ids, expectedIDs []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	permissions, err := journalPermissions(ctx, tx, journalID, userID)
	if err != nil {
		return err
	}
	if !permissions.Edit {
		return ErrJournalReadOnly
	}
	var locked int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.journal_section WHERE journal_id=$1 AND id=$2 FOR UPDATE`, journalID, sectionID).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `SELECT id FROM dndshare.journal_entry WHERE section_id=$1 ORDER BY position,id FOR UPDATE`, sectionID)
	if err != nil {
		return err
	}
	current, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return err
	}
	if !slices.Equal(current, expectedIDs) || len(current) != len(ids) {
		return ErrJournalOrderConflict
	}
	remaining := make(map[int64]bool, len(current))
	for _, id := range current {
		remaining[id] = true
	}
	for _, id := range ids {
		if !remaining[id] {
			return ErrJournalOrderConflict
		}
		delete(remaining, id)
	}
	if _, err = tx.Exec(ctx, `SET CONSTRAINTS dndshare.journal_entry_position_key DEFERRED`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal_entry e SET position=ordered.position
		FROM unnest($2::bigint[]) WITH ORDINALITY AS ordered(id,position)
		WHERE e.section_id=$1 AND e.id=ordered.id`, sectionID, ids); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET changed_at=now() WHERE id=$1`, journalID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
