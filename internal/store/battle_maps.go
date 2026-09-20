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
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	Document  battlemap.Document `json:"document"`
	Revision  int64              `json:"revision"`
	ChangedAt time.Time          `json:"changedAt"`
	System    bool               `json:"system"`
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
	if m.ID == "" {
		return scanBattleMap(s.pool.QueryRow(ctx, `INSERT INTO dndshare.battle_map(owner_user_id,name,document,asset_id) VALUES($1,$2,CAST($3 AS jsonb),$4) RETURNING id::text,name,document,revision,changed_at`, userID, m.Name, json.RawMessage(raw), m.Document.Background.AssetID))
	}
	result, err := scanBattleMap(s.pool.QueryRow(ctx, `UPDATE dndshare.battle_map SET name=$3,document=CAST($4 AS jsonb),asset_id=$5,revision=revision+1,changed_at=now() WHERE owner_user_id=$1 AND id=$2::uuid AND revision=$6 RETURNING id::text,name,document,revision,changed_at`, userID, m.ID, m.Name, json.RawMessage(raw), m.Document.Background.AssetID, m.Revision))
	if errors.Is(err, ErrNotFound) {
		return result, ErrMapConflict
	}
	return result, err
}

func (s *Store) DeleteBattleMap(ctx context.Context, userID int64, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM dndshare.battle_map WHERE owner_user_id=$1 AND id=$2::uuid`, userID, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
