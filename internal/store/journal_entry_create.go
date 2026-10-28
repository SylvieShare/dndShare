package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateJournalEntry(ctx context.Context, journalID, sectionID, userID int64, mutation JournalEntryMutation) (int64, error) {
	payload := mutation.Payload
	if len(payload) == 0 {
		payload = json.RawMessage("{}")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return 0, err
	}
	key := JournalCreationIdentity{UserID: userID, ClientActionID: mutation.ClientActionID}
	replay, fingerprint, err := journalCreationReplay(ctx, tx, journalID, key, "entry", struct {
		SectionID int64
		Mutation  JournalEntryMutation
	}{sectionID, mutation})
	if err != nil {
		return 0, err
	}
	if replay != 0 {
		return replay, nil
	}
	if err = lockJournalGraph(ctx, tx, journalID, mutation.ExpectedGraphRevision); err != nil {
		return 0, err
	}
	var lockedID int64
	if err := tx.QueryRow(ctx, `
		SELECT id FROM dndshare.journal_section WHERE id = $2 AND journal_id = $1 FOR UPDATE`, journalID, sectionID).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.journal_entry (
			section_id, author_user_id, changed_by_user_id, position, entry_type, title, description_html,
			payload, source_scene_item_id, source_snapshot
		)
		VALUES ($1, $2, $2,
		       COALESCE((SELECT MAX(position) FROM dndshare.journal_entry WHERE section_id = $1), 0) + 1,
		       $3, $4, $5, CAST($6 AS jsonb), $7, CAST($8 AS jsonb))
		RETURNING id`, sectionID, userID, mutation.Type, mutation.Title, mutation.Description,
		string(payload), mutation.SourceSceneItemID, nullableJSON(mutation.SourceSnapshot)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	if err = attachJournalEntry(ctx, tx, journalID, sectionID, id, mutation); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET changed_at = now() WHERE id = $1`, journalID); err != nil {
		return 0, err
	}
	if err = saveJournalCreationReceipt(ctx, tx, journalID, id, key, "entry", fingerprint); err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}
