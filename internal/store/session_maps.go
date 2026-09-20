package store

import (
	"context"
	"encoding/json"
	"errors"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
)

type SessionMap struct {
	BattleMap
	State battlemap.State `json:"state"`
}

type MapDisplay struct {
	MapID    *string          `json:"mapId"`
	Visible  bool             `json:"visible"`
	Camera   battlemap.Camera `json:"camera"`
	Revision int64            `json:"revision"`
}

func scanSessionMap(row pgx.Row) (SessionMap, error) {
	var m SessionMap
	var doc, state []byte
	err := row.Scan(&m.ID, &m.Name, &doc, &state, &m.Revision, &m.ChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(doc, &m.Document)
	}
	if err == nil {
		err = json.Unmarshal(state, &m.State)
	}
	return m, err
}

func (s *Store) ListSessionMaps(ctx context.Context, sessionID int64) ([]SessionMap, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,document,state,revision,changed_at FROM dndshare.session_map WHERE session_id=$1 ORDER BY changed_at DESC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []SessionMap{}
	for rows.Next() {
		m, err := scanSessionMap(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func (s *Store) GetSessionMap(ctx context.Context, sessionID int64, id string) (SessionMap, error) {
	return scanSessionMap(s.pool.QueryRow(ctx, `SELECT id::text,name,document,state,revision,changed_at FROM dndshare.session_map WHERE session_id=$1 AND id=$2::uuid`, sessionID, id))
}

func (s *Store) AddSessionMap(ctx context.Context, sessionID int64, m BattleMap) (SessionMap, error) {
	doc, err := json.Marshal(m.Document)
	if err != nil {
		return SessionMap{}, err
	}
	state, _ := json.Marshal(battlemap.InitialState())
	return scanSessionMap(s.pool.QueryRow(ctx, `INSERT INTO dndshare.session_map(session_id,name,document,state,asset_id) VALUES($1,$2,CAST($3 AS jsonb),CAST($4 AS jsonb),$5) RETURNING id::text,name,document,state,revision,changed_at`, sessionID, m.Name, json.RawMessage(doc), json.RawMessage(state), m.Document.Background.AssetID))
}

func (s *Store) SaveSessionMapState(ctx context.Context, sessionID int64, id string, revision int64, state battlemap.State) (SessionMap, error) {
	raw, err := json.Marshal(state)
	if err != nil {
		return SessionMap{}, err
	}
	m, err := scanSessionMap(s.pool.QueryRow(ctx, `UPDATE dndshare.session_map SET state=CAST($4 AS jsonb),revision=revision+1,changed_at=now() WHERE session_id=$1 AND id=$2::uuid AND revision=$3 RETURNING id::text,name,document,state,revision,changed_at`, sessionID, id, revision, json.RawMessage(raw)))
	if errors.Is(err, ErrNotFound) {
		return m, ErrMapConflict
	}
	return m, err
}

func (s *Store) DeleteSessionMap(ctx context.Context, sessionID int64, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_map_display SET map_id=NULL,visible=false,revision=revision+1 WHERE session_id=$1 AND map_id=$2::uuid`, sessionID, id)
	if err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM dndshare.session_map WHERE session_id=$1 AND id=$2::uuid`, sessionID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

func (s *Store) GetMapDisplay(ctx context.Context, sessionID int64) (MapDisplay, error) {
	m := MapDisplay{Camera: battlemap.Camera{CellPixels: 64, Fit: true}}
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT map_id::text,visible,camera,revision FROM dndshare.session_map_display WHERE session_id=$1`, sessionID).Scan(&m.MapID, &m.Visible, &raw, &m.Revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, nil
	}
	if err == nil {
		err = json.Unmarshal(raw, &m.Camera)
	}
	return m, err
}

func (s *Store) SaveMapDisplay(ctx context.Context, sessionID int64, m MapDisplay) (MapDisplay, error) {
	raw, err := json.Marshal(m.Camera)
	if err != nil {
		return m, err
	}
	// Creating the empty row separately makes the first compare-and-swap atomic too.
	_, err = s.pool.Exec(ctx, `INSERT INTO dndshare.session_map_display(session_id) VALUES($1) ON CONFLICT DO NOTHING`, sessionID)
	if err != nil {
		return m, err
	}
	err = s.pool.QueryRow(ctx, `UPDATE dndshare.session_map_display SET map_id=$2::uuid,visible=$3,camera=CAST($4 AS jsonb),revision=revision+1 WHERE session_id=$1 AND revision=$5 RETURNING revision`, sessionID, m.MapID, m.Visible, json.RawMessage(raw), m.Revision).Scan(&m.Revision)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrMapConflict
	}
	return m, err
}
