package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type JournalPermissions struct{ Read, Edit, Manage bool }

func (s *Store) JournalPermissions(ctx context.Context, journalID, userID int64) (JournalPermissions, error) {
	return journalPermissions(ctx, s.pool, journalID, userID)
}

func journalPermissions(ctx context.Context, db interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, journalID, userID int64) (JournalPermissions, error) {
	var p JournalPermissions
	err := db.QueryRow(ctx, `
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

var ErrJournalEntryConflict = errors.New("journal entry has changed since editing started")
