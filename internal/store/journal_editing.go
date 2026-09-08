package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type JournalPermissions struct{ Read, Edit, Manage bool }

func (s *Store) JournalPermissions(ctx context.Context, journalID, userID int64) (JournalPermissions, error) {
	var p JournalPermissions
	err := s.pool.QueryRow(ctx, `
		SELECT personal OR dm OR member, personal OR dm OR (member AND players_can_edit), dm
		FROM (
			SELECT COALESCE(j.owner_user_id = $2, false) AS personal, j.players_can_edit,
			 COALESCE(NOT session.deleted AND session.owner_user_id = $2, false) AS dm,
			 COALESCE(NOT session.deleted AND EXISTS (
			  SELECT 1 FROM dndshare.session_participant p WHERE p.session_id = j.session_id AND p.user_id = $2
			 ), false) AS member
			FROM dndshare.journal j LEFT JOIN dndshare."session" session ON session.id = j.session_id
			WHERE j.id = $1
		) access`, journalID, userID).Scan(&p.Read, &p.Edit, &p.Manage)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

func (s *Store) SetJournalPlayerEditing(ctx context.Context, journalID, userID int64, enabled bool) error {
	result, err := s.pool.Exec(ctx, `UPDATE dndshare.journal j SET players_can_edit=$3, changed_at=now()
		FROM dndshare."session" session WHERE j.id=$1 AND j.session_id=session.id
		AND session.owner_user_id=$2 AND NOT session.deleted`, journalID, userID, enabled)
	if err == nil && result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

var ErrJournalOrderConflict = errors.New("journal events changed; refresh before reordering")
var ErrJournalEntryConflict = errors.New("journal entry has changed since editing started")

func (s *Store) ReorderJournalEntries(ctx context.Context, journalID, sectionID int64, ids []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var locked int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.journal_section WHERE journal_id=$1 AND id=$2 FOR UPDATE`, journalID, sectionID).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `SELECT id FROM dndshare.journal_entry WHERE section_id=$1 FOR UPDATE`, sectionID)
	if err != nil {
		return err
	}
	current, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return err
	}
	if len(current) != len(ids) {
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
