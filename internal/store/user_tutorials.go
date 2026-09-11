package store

import (
	"context"
	"strconv"
	"strings"
	"time"
)

type UserTutorial struct {
	FlowID    string    `json:"flowId"`
	SourceKey string    `json:"sourceKey"`
	Device    string    `json:"device"`
	Revision  int       `json:"revision"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (s *Store) ListUserTutorials(ctx context.Context, userID int64) ([]UserTutorial, error) {
	rows, err := s.pool.Query(ctx, `SELECT flow_id, source_key, device, revision, status, updated_at
 FROM dndshare.user_tutorial WHERE user_id = $1 ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []UserTutorial{}
	for rows.Next() {
		var entry UserTutorial
		if err := rows.Scan(&entry.FlowID, &entry.SourceKey, &entry.Device, &entry.Revision, &entry.Status, &entry.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}

// Updating one tuple avoids lost updates between devices and unrelated flows.
const saveUserTutorialSQL = `INSERT INTO dndshare.user_tutorial
 (user_id, flow_id, source_key, device, revision, status) VALUES ($1, $2, $3, $4, $5, $6)
 ON CONFLICT (user_id, flow_id, source_key, device) DO UPDATE SET
 revision = EXCLUDED.revision, status = CASE
 WHEN dndshare.user_tutorial.revision = EXCLUDED.revision AND dndshare.user_tutorial.status = 'completed' THEN 'completed'
 ELSE EXCLUDED.status END, updated_at = now()
 WHERE dndshare.user_tutorial.revision <= EXCLUDED.revision`

func (s *Store) SaveUserTutorial(ctx context.Context, userID int64, entry UserTutorial) error {
	_, err := s.pool.Exec(ctx, saveUserTutorialSQL, userID, entry.FlowID, entry.SourceKey, entry.Device, entry.Revision, entry.Status)
	return err
}

func (s *Store) ResetUserTutorial(ctx context.Context, userID int64, entry UserTutorial) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.user_tutorial
 WHERE user_id = $1 AND flow_id = $2 AND source_key = $3 AND device = $4`, userID, entry.FlowID, entry.SourceKey, entry.Device)
	return err
}

func (s *Store) TutorialSourceExists(ctx context.Context, key string) (bool, error) {
	if key == "unassigned" {
		return true, nil
	}
	kind, value, _ := strings.Cut(key, ":")
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return false, nil
	}
	if kind == "edition" {
		return s.SourceVersionExists(ctx, id)
	}
	var exists bool
	err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.source WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}
