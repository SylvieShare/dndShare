package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateJournalSection(ctx context.Context, journalID int64, title, date string, identity ...JournalCreationIdentity) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var sessionID *int64
	if err := tx.QueryRow(ctx, `SELECT session_id FROM dndshare.journal WHERE id = $1 FOR UPDATE`, journalID).Scan(&sessionID); errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, err
	}
	if sessionID != nil {
		return 0, ErrJournalSectionManaged
	}
	key := JournalCreationIdentity{}
	if len(identity) > 0 {
		key = identity[0]
	}
	replay, fingerprint, err := journalCreationReplay(ctx, tx, journalID, key, "section", []string{title, date})
	if err != nil {
		return 0, err
	}
	if replay != 0 {
		return replay, nil
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.journal_section (journal_id, position, title, event_date)
		VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM dndshare.journal_section WHERE journal_id = $1), $2, $3)
		RETURNING id`, journalID, title, date).Scan(&id)
	if err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET changed_at = now() WHERE id = $1`, journalID); err != nil {
		return 0, err
	}
	if err = saveJournalCreationReceipt(ctx, tx, journalID, id, key, "section", fingerprint); err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

func (s *Store) UpdateJournalSection(ctx context.Context, journalID, sectionID int64, title, date string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			UPDATE dndshare.journal_section SET title = $3, event_date = $4, changed_at = now()
			WHERE id = $2 AND journal_id = $1 AND occurrence_id IS NULL RETURNING journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`, journalID, sectionID, title, date)
	if err == nil && command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteJournalSection(ctx context.Context, journalID, sectionID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			DELETE FROM dndshare.journal_section WHERE id = $2 AND journal_id = $1 AND occurrence_id IS NULL RETURNING journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`, journalID, sectionID)
	if err == nil && command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
