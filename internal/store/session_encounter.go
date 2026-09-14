package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

// GetEncounterData возвращает последний активный энкаунтер сессии как JSON-строку
// или nil, если его нет (порт SessionEncounterRepository.getEncounterData).
func (s *Store) GetEncounterData(ctx context.Context, sessionID int64) (*string, error) {
	var data *string
	err := s.pool.QueryRow(ctx,
		`SELECT data::text FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1`,
		sessionID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return data, err
}

// SaveEncounterData обновляет последний активный энкаунтер или создаёт новый (порт saveEncounterData).
// Один statement под транзакцией, чтобы конкурентные сохранения не плодили дубли (у таблицы нет
// UNIQUE по session_id, поэтому используем UPDATE-затем-INSERT в tx с блокировкой строки).
func (s *Store) SaveEncounterData(ctx context.Context, sessionID int64, status string, round int, data string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var existing int64
	var previous json.RawMessage
	err = tx.QueryRow(ctx,
		`SELECT id,data FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1 FOR UPDATE`,
		sessionID,
	).Scan(&existing, &previous)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err = tx.Exec(ctx,
			`INSERT INTO dndshare.session_encounter (session_id, status, round, data)
			 VALUES ($1, $2, $3, CAST($4 AS jsonb))`,
			sessionID, status, round, data,
		); err != nil {
			return err
		}
	} else {
		var oldDoc, newDoc map[string]any
		if json.Unmarshal(previous, &oldDoc) != nil || json.Unmarshal([]byte(data), &newDoc) != nil {
			return ErrApplication
		}
		if number(oldDoc["applicationRevision"]) != number(newDoc["applicationRevision"]) {
			return ErrCharacterVersion
		}
		if _, err = tx.Exec(ctx,
			`UPDATE dndshare.session_encounter SET status = $2, round = $3, data = CAST($4 AS jsonb), changed_at = now()
			 WHERE id = $1`,
			existing, status, round, data,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
