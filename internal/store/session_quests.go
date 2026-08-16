package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) GetSessionQuest(ctx context.Context, id int64) (SessionQuest, error) {
	quest := SessionQuest{Relations: []SessionEntityRelation{}}
	err := s.pool.QueryRow(ctx, `
		SELECT id, session_id, name, status, description, sort_order
		FROM dndshare.session_quest WHERE id = $1`, id,
	).Scan(&quest.ID, &quest.SessionID, &quest.Name, &quest.Status, &quest.Description, &quest.SortOrder)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionQuest{}, ErrNotFound
	}
	return quest, err
}

func (s *Store) CreateSessionQuest(ctx context.Context, sessionID int64, mutation SessionQuestMutation) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityQuest, 0, mutation.Relations); err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.session_quest (session_id, name, status, description, sort_order)
		VALUES ($1, $2, $3, $4,
		  (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM dndshare.session_quest WHERE session_id = $1))
		RETURNING id`, sessionID, mutation.Name, mutation.Status, mutation.Description).Scan(&id)
	if err != nil {
		return 0, err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityQuest, id, mutation.Relations); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) UpdateSessionQuest(ctx context.Context, sessionID, questID int64, mutation SessionQuestMutation) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityQuest, questID, mutation.Relations); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		UPDATE dndshare.session_quest
		SET name = $3, status = $4, description = $5, changed_at = now()
		WHERE id = $1 AND session_id = $2`, questID, sessionID, mutation.Name, mutation.Status, mutation.Description)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityQuest, questID, mutation.Relations); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteSessionQuest(ctx context.Context, sessionID, questID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := ensureSessionEntityNotUsedBySceneTx(ctx, tx, sessionID, SessionEntityQuest, questID); err != nil {
		return err
	}
	if err := deleteSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityQuest, questID); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `DELETE FROM dndshare.session_quest WHERE id = $1 AND session_id = $2`, questID, sessionID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}
