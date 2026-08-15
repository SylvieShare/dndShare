package store

import "context"

// GraphNodePosition is one persisted node coordinate in a narrative canvas.
type GraphNodePosition struct {
	ID int64   `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
}

func graphNodeQueries(level string) (membership, update string, ok bool) {
	switch level {
	case "chapters":
		return `SELECT count(*) FROM dndshare.session_chapter
			 WHERE session_id = $1 AND id = ANY($2)`,
			`UPDATE dndshare.session_chapter SET position_x = $2, position_y = $3 WHERE id = $1`, true
	case "scenes":
		return `SELECT count(*)
			 FROM dndshare.session_scene scene
			 JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
			 WHERE chapter.session_id = $1 AND scene.id = ANY($2)`,
			`UPDATE dndshare.session_scene SET position_x = $2, position_y = $3 WHERE id = $1`, true
	case "blocks":
		return `SELECT count(*)
			 FROM dndshare.session_scene_item item
			 JOIN dndshare.session_scene scene ON scene.id = item.scene_id
			 JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
			 WHERE chapter.session_id = $1 AND item.id = ANY($2)`,
			`UPDATE dndshare.session_scene_item SET position_x = $2, position_y = $3 WHERE id = $1`, true
	default:
		return "", "", false
	}
}

// UpdateGraphNodePositions atomically validates and persists a group movement.
func (s *Store) UpdateGraphNodePositions(ctx context.Context, sessionID int64, level string, positions []GraphNodePosition) error {
	membership, update, ok := graphNodeQueries(level)
	if !ok {
		return ErrNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	ids := make([]int64, len(positions))
	for index, position := range positions {
		ids[index] = position.ID
	}
	var count int
	if err := tx.QueryRow(ctx, membership, sessionID, ids).Scan(&count); err != nil {
		return err
	}
	if count != len(positions) {
		return ErrNotFound
	}
	for _, position := range positions {
		result, err := tx.Exec(ctx, update, position.ID, position.X, position.Y)
		if err != nil {
			return err
		}
		if result.RowsAffected() != 1 {
			return ErrNotFound
		}
	}
	return tx.Commit(ctx)
}

// UpdateGraphNodeStatus atomically updates chapter nodes after validating that
// every requested node belongs to the session.
func (s *Store) UpdateGraphNodeStatus(ctx context.Context, sessionID int64, level string, ids []int64, status string) error {
	if level != "chapters" {
		return ErrNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx,
		`UPDATE dndshare.session_chapter SET status = $3
		 WHERE session_id = $1 AND id = ANY($2)`, sessionID, ids, status)
	if err != nil {
		return err
	}
	if result.RowsAffected() != int64(len(ids)) {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// DeleteGraphNodes atomically deletes selected nodes. Chapters with scenes are
// intentionally rejected as a whole, matching single-chapter deletion.
func (s *Store) DeleteGraphNodes(ctx context.Context, sessionID int64, level string, ids []int64) (bool, error) {
	membership, _, ok := graphNodeQueries(level)
	if !ok {
		return false, ErrNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var count int
	if err := tx.QueryRow(ctx, membership, sessionID, ids).Scan(&count); err != nil {
		return false, err
	}
	if count != len(ids) {
		return false, ErrNotFound
	}

	var resultCount int64
	switch level {
	case "chapters":
		var scenes int
		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM dndshare.session_scene WHERE chapter_id = ANY($1)`, ids,
		).Scan(&scenes); err != nil {
			return false, err
		}
		if scenes > 0 {
			return false, nil
		}
		if _, err := tx.Exec(ctx,
			`UPDATE dndshare."session" SET current_chapter_id = NULL
			 WHERE id = $1 AND current_chapter_id = ANY($2)`, sessionID, ids); err != nil {
			return false, err
		}
		result, err := tx.Exec(ctx,
			`DELETE FROM dndshare.session_chapter WHERE session_id = $1 AND id = ANY($2)`, sessionID, ids)
		if err != nil {
			return false, err
		}
		resultCount = result.RowsAffected()
	case "scenes":
		if _, err := tx.Exec(ctx,
			`DELETE FROM dndshare.session_scene_item WHERE scene_id = ANY($1)`, ids); err != nil {
			return false, err
		}
		result, err := tx.Exec(ctx, `DELETE FROM dndshare.session_scene WHERE id = ANY($1)`, ids)
		if err != nil {
			return false, err
		}
		resultCount = result.RowsAffected()
	case "blocks":
		result, err := tx.Exec(ctx, `DELETE FROM dndshare.session_scene_item WHERE id = ANY($1)`, ids)
		if err != nil {
			return false, err
		}
		resultCount = result.RowsAffected()
	}
	if resultCount != int64(len(ids)) {
		return false, ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
