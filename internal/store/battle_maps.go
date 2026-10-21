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
var ErrMapPublished = errors.New("published map is immutable")
var ErrMapSubscriptionRequired = errors.New("map subscription required")

type BattleMap struct {
	ID                     string             `json:"id"`
	Name                   string             `json:"name"`
	Document               battlemap.Document `json:"document"`
	Revision               int64              `json:"revision"`
	ChangedAt              time.Time          `json:"changedAt"`
	PublishedAt            *time.Time         `json:"publishedAt"`
	OwnerUserID            int64              `json:"-"`
	Owned                  bool               `json:"owned"`
	Subscribed             bool               `json:"subscribed"`
	Author                 string             `json:"author"`
	PreviewURL             string             `json:"previewUrl,omitempty"`
	PreviewSignature       string             `json:"previewSignature,omitempty"`
	PreviewStale           bool               `json:"previewStale,omitempty"`
	PreviewModelsSignature string             `json:"previewModelsSignature,omitempty"`
}

func scanBattleMap(row pgx.Row) (BattleMap, error) {
	var m BattleMap
	var raw []byte
	err := row.Scan(&m.ID, &m.Name, &raw, &m.Revision, &m.ChangedAt, &m.PublishedAt, &m.OwnerUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &m.Document)
	}
	return m, err
}

func (s *Store) GetBattleMap(ctx context.Context, userID int64, id string) (BattleMap, error) {
	m, err := scanBattleMap(s.pool.QueryRow(ctx, `SELECT id::text,name,document,revision,changed_at,published_at,owner_user_id FROM dndshare.battle_map WHERE owner_user_id=$1 AND id=$2::uuid`, userID, id))
	m.Owned = err == nil
	return m, err
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
		result, err = scanBattleMap(tx.QueryRow(ctx, `INSERT INTO dndshare.battle_map(owner_user_id,name,document) VALUES($1,$2,CAST($3 AS jsonb)) RETURNING id::text,name,document,revision,changed_at,published_at,owner_user_id`, userID, m.Name, json.RawMessage(raw)))
	} else {
		var published *time.Time
		err = tx.QueryRow(ctx, `SELECT published_at FROM dndshare.battle_map WHERE id=$1::uuid AND owner_user_id=$2 FOR UPDATE`, m.ID, userID).Scan(&published)
		if errors.Is(err, pgx.ErrNoRows) {
			return result, ErrNotFound
		}
		if err != nil {
			return result, err
		}
		if published != nil {
			return result, ErrMapPublished
		}
		result, err = scanBattleMap(tx.QueryRow(ctx, `UPDATE dndshare.battle_map SET name=$3,document=CAST($4 AS jsonb),revision=revision+1,changed_at=now() WHERE owner_user_id=$1 AND id=$2::uuid AND revision=$5 AND published_at IS NULL RETURNING id::text,name,document,revision,changed_at,published_at,owner_user_id`, userID, m.ID, m.Name, json.RawMessage(raw), m.Revision))
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
	result.Owned = true
	return result, tx.Commit(ctx)
}

func (s *Store) DeleteBattleMap(ctx context.Context, userID int64, id string) error {
	_, err := s.DeleteBattleMapWithPreview(ctx, userID, id)
	return err
}
