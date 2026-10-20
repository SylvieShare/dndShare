package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

type MapPreview struct {
	Signature string
	ObjectKey string
	FileSize  int64
}

func (s *Store) GetMapPreview(ctx context.Context, mapID string) (MapPreview, error) {
	var p MapPreview
	err := s.pool.QueryRow(ctx, `SELECT signature,object_key,file_size FROM dndshare.battle_map_preview WHERE map_id=$1::uuid`, mapID).Scan(&p.Signature, &p.ObjectKey, &p.FileSize)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return p, err
}

// The map lock serializes preview publication with edits and deletion.
func (s *Store) SaveMapPreview(ctx context.Context, owner int64, m BattleMap, p MapPreview) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	{
		var revision int64
		err = tx.QueryRow(ctx, `SELECT revision FROM dndshare.battle_map WHERE id=$1::uuid AND owner_user_id=$2 FOR UPDATE`, m.ID, owner).Scan(&revision)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		if err != nil {
			return "", err
		}
		if revision != m.Revision {
			return "", ErrMapConflict
		}
	}
	var old string
	err = tx.QueryRow(ctx, `SELECT object_key FROM dndshare.battle_map_preview WHERE map_id=$1::uuid`, m.ID).Scan(&old)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.battle_map_preview (map_id,signature,object_key,file_size) VALUES ($1::uuid,$2,$3,$4) ON CONFLICT (map_id) DO UPDATE SET signature=EXCLUDED.signature,object_key=EXCLUDED.object_key,file_size=EXCLUDED.file_size,changed_at=now()`, m.ID, p.Signature, p.ObjectKey, p.FileSize)
	if err != nil {
		return "", err
	}
	return old, tx.Commit(ctx)
}
func (s *Store) DeleteBattleMapWithPreview(ctx context.Context, owner int64, id string) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var found string
	var published bool
	err = tx.QueryRow(ctx, `SELECT id::text,published_at IS NOT NULL FROM dndshare.battle_map WHERE id=$1::uuid AND owner_user_id=$2 FOR UPDATE`, id, owner).Scan(&found, &published)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if published {
		return "", ErrMapPublished
	}
	var key string
	err = tx.QueryRow(ctx, `SELECT object_key FROM dndshare.battle_map_preview WHERE map_id=$1::uuid`, id).Scan(&key)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM dndshare.battle_map WHERE id=$1::uuid`, id); err != nil {
		return "", err
	}
	return key, tx.Commit(ctx)
}
