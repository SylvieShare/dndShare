package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
)

var ErrMapConflict = errors.New("map revision conflict")

type BattleMap struct {
	ID               string             `json:"id"`
	Name             string             `json:"name"`
	Document         battlemap.Document `json:"document"`
	Revision         int64              `json:"revision"`
	ChangedAt        time.Time          `json:"changedAt"`
	System           bool               `json:"system"`
	PreviewURL       string             `json:"previewUrl,omitempty"`
	PreviewSignature string             `json:"previewSignature,omitempty"`
}

func scanBattleMap(row pgx.Row) (BattleMap, error) {
	var m BattleMap
	var raw []byte
	err := row.Scan(&m.ID, &m.Name, &raw, &m.Revision, &m.ChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &m.Document)
	}
	return m, err
}

func (s *Store) ListBattleMaps(ctx context.Context, userID int64) ([]BattleMap, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,document,revision,changed_at FROM dndshare.battle_map WHERE owner_user_id=$1 ORDER BY changed_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []BattleMap{}
	for rows.Next() {
		m, err := scanBattleMap(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func (s *Store) GetBattleMap(ctx context.Context, userID int64, id string) (BattleMap, error) {
	return scanBattleMap(s.pool.QueryRow(ctx, `SELECT id::text,name,document,revision,changed_at FROM dndshare.battle_map WHERE owner_user_id=$1 AND id=$2::uuid`, userID, id))
}

func (s *Store) SaveBattleMap(ctx context.Context, userID int64, m BattleMap) (BattleMap, error) {
	raw, err := json.Marshal(m.Document)
	if err != nil {
		return m, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return m, err
	}
	defer tx.Rollback(ctx)
	var result BattleMap
	if m.ID == "" {
		result, err = scanBattleMap(tx.QueryRow(ctx, `INSERT INTO dndshare.battle_map(owner_user_id,name,document) VALUES($1,$2,CAST($3 AS jsonb)) RETURNING id::text,name,document,revision,changed_at`, userID, m.Name, json.RawMessage(raw)))
	} else {
		result, err = scanBattleMap(tx.QueryRow(ctx, `UPDATE dndshare.battle_map SET name=$3,document=CAST($4 AS jsonb),revision=revision+1,changed_at=now() WHERE owner_user_id=$1 AND id=$2::uuid AND revision=$5 RETURNING id::text,name,document,revision,changed_at`, userID, m.ID, m.Name, json.RawMessage(raw), m.Revision))
	}
	if errors.Is(err, ErrNotFound) {
		return result, ErrMapConflict
	}
	if err != nil {
		return result, err
	}
	if err = syncMapModels(ctx, tx, "battle_map_model", "map_id", result.ID, m.Document); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func (s *Store) DeleteBattleMap(ctx context.Context, userID int64, id string) error {
	_, err := s.DeleteBattleMapWithPreview(ctx, userID, id)
	return err
}
