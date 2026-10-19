package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"dndshare/internal/globalmap"
	"github.com/jackc/pgx/v5"
)

type GlobalMap struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	ImageID  int64             `json:"imageId"`
	ImageURL string            `json:"imageUrl"`
	Routes   []globalmap.Route `json:"routes"`
	Current  bool              `json:"current"`
	Revision int64             `json:"revision"`
}

const globalMapSelect = `SELECT m.id::text,m.name,m.image_id,i.url,m.routes,m.is_current,m.revision
 FROM dndshare.session_global_map m JOIN dndshare.storage_image i ON i.id=m.image_id`

func scanGlobalMap(row pgx.Row) (GlobalMap, error) {
	var m GlobalMap
	var raw []byte
	err := row.Scan(&m.ID, &m.Name, &m.ImageID, &m.ImageURL, &raw, &m.Current, &m.Revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &m.Routes)
	}
	if m.Routes == nil {
		m.Routes = []globalmap.Route{}
	}
	return m, err
}

func (s *Store) ListGlobalMaps(ctx context.Context, sid int64) ([]GlobalMap, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	players, chapters, locations, err := globalMapReferences(ctx, tx, sid)
	if err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, globalMapSelect+` WHERE m.session_id=$1 ORDER BY m.created_at,m.id`, sid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []GlobalMap{}
	for rows.Next() {
		m, err := scanGlobalMap(rows)
		if err != nil {
			return nil, err
		}
		globalmap.PruneReferences(m.Routes, players, chapters, locations)
		result = append(result, m)
	}
	return result, rows.Err()
}

func (s *Store) globalMapTx(ctx context.Context, sid int64) (pgx.Tx, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	var id int64
	if err = tx.QueryRow(ctx, `SELECT id FROM dndshare.session WHERE id=$1 FOR UPDATE`, sid).Scan(&id); err != nil {
		tx.Rollback(ctx)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return tx, nil
}

func (s *Store) CreateGlobalMap(ctx context.Context, sid, uid, imageID int64, name string) (GlobalMap, error) {
	tx, err := s.globalMapTx(ctx, sid)
	if err != nil {
		return GlobalMap{}, err
	}
	defer tx.Rollback(ctx)
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_global_map WHERE session_id=$1`, sid).Scan(&count); err != nil {
		return GlobalMap{}, err
	}
	if count >= 32 {
		return GlobalMap{}, fmt.Errorf("%w: не более 32 карт в сессии", ErrInvalidWorldReference)
	}
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.storage_image WHERE id=$1 AND user_id=$2 AND NOT deleted AND "type"='image')`, imageID, uid).Scan(&allowed)
	if err != nil {
		return GlobalMap{}, err
	}
	if !allowed {
		return GlobalMap{}, ErrInvalidWorldReference
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_global_map SET is_current=false WHERE session_id=$1 AND is_current`, sid); err != nil {
		return GlobalMap{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_global_map(session_id,name,image_id,is_current) VALUES($1,$2,$3,true) RETURNING id::text`, sid, name, imageID).Scan(&id)
	if err != nil {
		return GlobalMap{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return GlobalMap{}, err
	}
	return scanGlobalMap(s.pool.QueryRow(ctx, globalMapSelect+` WHERE m.session_id=$1 AND m.id=$2::uuid`, sid, id))
}

func (s *Store) SaveGlobalMap(ctx context.Context, sid int64, m GlobalMap) (GlobalMap, error) {
	tx, err := s.globalMapTx(ctx, sid)
	if err != nil {
		return m, err
	}
	defer tx.Rollback(ctx)
	players, chapters, locations, err := globalMapReferences(ctx, tx, sid)
	if err != nil {
		return m, err
	}
	for _, route := range m.Routes {
		for _, id := range route.PlayerIDs {
			if !players[id] {
				return m, ErrInvalidWorldReference
			}
		}
		for _, p := range route.Points {
			for _, id := range p.ChapterIDs() {
				if !chapters[id] {
					return m, ErrInvalidWorldReference
				}
			}
			for _, id := range p.LocationIDs {
				if !locations[id] {
					return m, ErrInvalidWorldReference
				}
			}
		}
	}
	globalmap.PruneReferences(m.Routes, players, chapters, locations)
	raw, err := json.Marshal(m.Routes)
	if err != nil {
		return m, err
	}
	tag, err := tx.Exec(ctx, `UPDATE dndshare.session_global_map SET name=$4,routes=CAST($5 AS jsonb),revision=revision+1,changed_at=now() WHERE session_id=$1 AND id=$2::uuid AND revision=$3`, sid, m.ID, m.Revision, m.Name, json.RawMessage(raw))
	if err != nil {
		return m, err
	}
	if tag.RowsAffected() == 0 {
		return m, ErrMapConflict
	}
	if err = tx.Commit(ctx); err != nil {
		return m, err
	}
	return scanGlobalMap(s.pool.QueryRow(ctx, globalMapSelect+` WHERE m.session_id=$1 AND m.id=$2::uuid`, sid, m.ID))
}

func (s *Store) ActivateGlobalMap(ctx context.Context, sid int64, id string) error {
	tx, err := s.globalMapTx(ctx, sid)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.session_global_map WHERE session_id=$1 AND id=$2::uuid)`, sid, id).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_global_map SET is_current=false WHERE session_id=$1 AND is_current`, sid); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_global_map SET is_current=true WHERE session_id=$1 AND id=$2::uuid`, sid, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteGlobalMap(ctx context.Context, sid int64, id string) error {
	tx, err := s.globalMapTx(ctx, sid)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `DELETE FROM dndshare.session_global_map WHERE session_id=$1 AND id=$2::uuid`, sid, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_global_map SET is_current=true WHERE id=(SELECT id FROM dndshare.session_global_map WHERE session_id=$1 ORDER BY created_at,id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM dndshare.session_global_map WHERE session_id=$1 AND is_current)`, sid)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
