package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) EncounterDocument(ctx context.Context, sessionID int64) (json.RawMessage, int64, error) {
	var raw json.RawMessage
	var version int64
	err := s.pool.QueryRow(ctx, `SELECT data,revision FROM dndshare.session_encounter WHERE session_id=$1 AND NOT deleted ORDER BY id DESC LIMIT 1`, sessionID).Scan(&raw, &version)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, err
	}
	doc := map[string]any{"active": false, "round": 0, "turnIndex": 0, "combatants": []any{}}
	if raw != nil {
		if err = json.Unmarshal(raw, &doc); err != nil {
			return nil, 0, err
		}
	}
	if err = projectSheetInitiatives(ctx, s.pool, sessionID, doc, doc); err != nil {
		return nil, 0, err
	}
	raw, err = json.Marshal(doc)
	return raw, version, err
}
