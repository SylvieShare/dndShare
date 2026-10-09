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
	State  battlemap.State `json:"state"`
	Source *MapSource      `json:"source,omitempty"`
}

type MapSource struct {
	ID     string `json:"id,omitempty"`
	Name   string `json:"name"`
	System bool   `json:"system"`
}

type MapDisplay struct {
	MapID    *string          `json:"mapId"`
	Visible  bool             `json:"visible"`
	Camera   battlemap.Camera `json:"camera"`
	Revision int64            `json:"revision"`
}

func scanSessionMap(row pgx.Row) (SessionMap, error) {
	var m SessionMap
	var doc, state, source []byte
	err := row.Scan(&m.ID, &m.Name, &doc, &state, &m.Revision, &m.ChangedAt, &source)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(doc, &m.Document)
	}
	if err == nil {
		err = json.Unmarshal(state, &m.State)
	}
	if err == nil {
		m.Source = &MapSource{}
		err = json.Unmarshal(source, m.Source)
	}
	return m, err
}

func (s *Store) ListSessionMaps(ctx context.Context, sessionID int64) ([]SessionMap, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,document,state,revision,changed_at,source FROM dndshare.session_map WHERE session_id=$1 ORDER BY changed_at DESC`, sessionID)
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
	return scanSessionMap(s.pool.QueryRow(ctx, `SELECT id::text,name,document,state,revision,changed_at,source FROM dndshare.session_map WHERE session_id=$1 AND id=$2::uuid`, sessionID, id))
}

func (s *Store) AddSessionMap(ctx context.Context, sessionID int64, m BattleMap) (SessionMap, error) {
	doc, err := json.Marshal(m.Document)
	if err != nil {
		return SessionMap{}, err
	}
	initial := battlemap.InitialState()
	initial.Fog = false
	state, _ := json.Marshal(initial)
	source, _ := json.Marshal(MapSource{ID: m.ID, Name: m.Name, System: m.System})
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionMap{}, err
	}
	defer tx.Rollback(ctx)
	result, err := scanSessionMap(tx.QueryRow(ctx, `INSERT INTO dndshare.session_map(session_id,name,document,state,source) VALUES($1,$2,CAST($3 AS jsonb),CAST($4 AS jsonb),CAST($5 AS jsonb)) RETURNING id::text,name,document,state,revision,changed_at,source`, sessionID, m.Name, json.RawMessage(doc), json.RawMessage(state), json.RawMessage(source)))
	if err != nil {
		return result, err
	}
	if err = syncMapModels(ctx, tx, "session_map_model", "map_id", result.ID, m.Document); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func (s *Store) SaveSessionMap(ctx context.Context, sessionID int64, m SessionMap) (SessionMap, error) {
	doc, err := json.Marshal(m.Document)
	if err != nil {
		return m, err
	}
	state, err := json.Marshal(m.State)
	if err != nil {
		return m, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return m, err
	}
	defer tx.Rollback(ctx)
	result, err := scanSessionMap(tx.QueryRow(ctx, `UPDATE dndshare.session_map SET name=$4,document=CAST($5 AS jsonb),state=CAST($6 AS jsonb),revision=revision+1,changed_at=now() WHERE session_id=$1 AND id=$2::uuid AND revision=$3 RETURNING id::text,name,document,state,revision,changed_at,source`, sessionID, m.ID, m.Revision, m.Name, json.RawMessage(doc), json.RawMessage(state)))
	if errors.Is(err, ErrNotFound) {
		return m, ErrMapConflict
	}
	if err != nil {
		return m, err
	}
	if err = syncMapModels(ctx, tx, "session_map_model", "map_id", m.ID, m.Document); err != nil {
		return m, err
	}
	return result, tx.Commit(ctx)
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
