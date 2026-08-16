package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

// SessionArc is one independently laid out campaign canvas.
type SessionArc struct {
	ID          int64   `json:"id"`
	SessionID   int64   `json:"sessionId"`
	Order       int     `json:"order"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// SessionChapter is a graph node. Number is display text so branches can use 3A/3B.
type SessionChapter struct {
	ID              int64   `json:"id"`
	SessionID       int64   `json:"sessionId"`
	ArcID           int64   `json:"arcId"`
	ArcOrder        int     `json:"arcOrder"`
	ArcName         string  `json:"arcName"`
	Number          string  `json:"number"`
	Name            string  `json:"name"`
	Description     *string `json:"description,omitempty"`
	Status          string  `json:"status"`
	ImageID         int64   `json:"imageId"`
	ImageURL        string  `json:"imageUrl"`
	ImageCatalogKey *string `json:"imageCatalogKey,omitempty"`
	ImageFocalX     float64 `json:"imageFocalX"`
	ImageFocalY     float64 `json:"imageFocalY"`
	PositionX       float64 `json:"positionX"`
	PositionY       float64 `json:"positionY"`
	SceneCount      int64   `json:"sceneCount"`
}

type SessionChapterEdge struct {
	ID            int64   `json:"id"`
	ArcID         int64   `json:"arcId"`
	FromChapterID int64   `json:"fromChapterId"`
	ToChapterID   int64   `json:"toChapterId"`
	Label         *string `json:"label,omitempty"`
}

type SessionChapterGraph struct {
	Arcs     []SessionArc         `json:"arcs"`
	Chapters []SessionChapter     `json:"chapters"`
	Edges    []SessionChapterEdge `json:"edges"`
}

type ChapterMutation struct {
	ArcID       int64
	Number      string
	Name        string
	Description *string
	Status      string
	ImageID     int64
	ImageFocalX float64
	ImageFocalY float64
	PositionX   float64
	PositionY   float64
}

const chapterSelect = `
	SELECT ch.id, ch.session_id, ch.arc_id, arc."order", arc.name,
	       ch.number, ch.name, ch.description, ch.status, ch.image_id,
	       COALESCE(img.url, ''), catalog.catalog_key, ch.image_focal_x, ch.image_focal_y,
	       ch.position_x, ch.position_y,
	       (SELECT count(*) FROM dndshare.session_scene scene WHERE scene.chapter_id = ch.id)
	FROM dndshare.session_chapter ch
	JOIN dndshare.session_arc arc ON arc.id = ch.arc_id
	JOIN dndshare.storage_image img ON img.id = ch.image_id AND img.deleted = false
	LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = ch.image_id`

func scanChapter(row pgx.Row) (SessionChapter, error) {
	var chapter SessionChapter
	err := row.Scan(
		&chapter.ID, &chapter.SessionID, &chapter.ArcID, &chapter.ArcOrder, &chapter.ArcName,
		&chapter.Number, &chapter.Name, &chapter.Description, &chapter.Status,
		&chapter.ImageID, &chapter.ImageURL, &chapter.ImageCatalogKey,
		&chapter.ImageFocalX, &chapter.ImageFocalY, &chapter.PositionX, &chapter.PositionY,
		&chapter.SceneCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionChapter{}, ErrNotFound
	}
	return chapter, err
}

func (s *Store) GetChapterGraph(ctx context.Context, sessionID int64) (SessionChapterGraph, error) {
	arcs, err := s.GetSessionArcs(ctx, sessionID)
	if err != nil {
		return SessionChapterGraph{}, err
	}
	chapters, err := s.GetChaptersBySession(ctx, sessionID)
	if err != nil {
		return SessionChapterGraph{}, err
	}
	edges, err := s.GetChapterEdgesBySession(ctx, sessionID)
	if err != nil {
		return SessionChapterGraph{}, err
	}
	return SessionChapterGraph{Arcs: arcs, Chapters: chapters, Edges: edges}, nil
}

func (s *Store) GetSessionArcs(ctx context.Context, sessionID int64) ([]SessionArc, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, session_id, "order", name, description
		 FROM dndshare.session_arc WHERE session_id = $1 ORDER BY "order", id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var arcs []SessionArc
	for rows.Next() {
		var arc SessionArc
		if err := rows.Scan(&arc.ID, &arc.SessionID, &arc.Order, &arc.Name, &arc.Description); err != nil {
			return nil, err
		}
		arcs = append(arcs, arc)
	}
	return arcs, rows.Err()
}

func (s *Store) GetSessionArc(ctx context.Context, id int64) (SessionArc, error) {
	var arc SessionArc
	err := s.pool.QueryRow(ctx,
		`SELECT id, session_id, "order", name, description FROM dndshare.session_arc WHERE id = $1`, id,
	).Scan(&arc.ID, &arc.SessionID, &arc.Order, &arc.Name, &arc.Description)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionArc{}, ErrNotFound
	}
	return arc, err
}

func (s *Store) CreateSessionArc(ctx context.Context, sessionID int64, name string, description *string) (SessionArc, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionArc{}, err
	}
	defer tx.Rollback(ctx)
	var lockedSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM dndshare."session" WHERE id = $1 FOR UPDATE`, sessionID,
	).Scan(&lockedSessionID); err != nil {
		return SessionArc{}, err
	}
	var arc SessionArc
	err = tx.QueryRow(ctx,
		`INSERT INTO dndshare.session_arc (session_id, "order", name, description)
		 VALUES ($1, (SELECT COALESCE(MAX("order"), 0) + 1 FROM dndshare.session_arc WHERE session_id = $1), $2, $3)
		 RETURNING id, session_id, "order", name, description`, sessionID, name, description,
	).Scan(&arc.ID, &arc.SessionID, &arc.Order, &arc.Name, &arc.Description)
	if err != nil {
		return SessionArc{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SessionArc{}, err
	}
	return arc, nil
}

func (s *Store) UpdateSessionArc(ctx context.Context, id int64, name string, description *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_arc SET name = $2, description = $3 WHERE id = $1`, id, name, description)
	return err
}

func (s *Store) ReorderSessionArcs(ctx context.Context, sessionID int64, ids []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var lockedSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM dndshare."session" WHERE id = $1 FOR UPDATE`, sessionID,
	).Scan(&lockedSessionID); err != nil {
		return err
	}
	var count int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dndshare.session_arc WHERE session_id = $1 AND id = ANY($2)`, sessionID, ids,
	).Scan(&count); err != nil {
		return err
	}
	var total int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dndshare.session_arc WHERE session_id = $1`, sessionID,
	).Scan(&total); err != nil {
		return err
	}
	if count != len(ids) || total != len(ids) {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare.session_arc SET "order" = -"order" WHERE session_id = $1`, sessionID); err != nil {
		return err
	}
	for index, id := range ids {
		if _, err := tx.Exec(ctx,
			`UPDATE dndshare.session_arc SET "order" = $2 WHERE id = $1 AND session_id = $3`,
			id, index+1, sessionID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteEmptySessionArc(ctx context.Context, id int64) (bool, error) {
	result, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.session_arc arc
		 WHERE arc.id = $1
		   AND NOT EXISTS (SELECT 1 FROM dndshare.session_chapter ch WHERE ch.arc_id = arc.id)`, id)
	return result.RowsAffected() > 0, err
}

func (s *Store) GetChaptersBySession(ctx context.Context, sessionID int64) ([]SessionChapter, error) {
	rows, err := s.pool.Query(ctx,
		chapterSelect+` WHERE ch.session_id = $1 ORDER BY arc."order", ch.id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var chapters []SessionChapter
	for rows.Next() {
		chapter, err := scanChapter(rows)
		if err != nil {
			return nil, err
		}
		chapters = append(chapters, chapter)
	}
	return chapters, rows.Err()
}

func (s *Store) GetChapterByID(ctx context.Context, id int64) (SessionChapter, error) {
	return scanChapter(s.pool.QueryRow(ctx, chapterSelect+` WHERE ch.id = $1`, id))
}

func (s *Store) CreateChapter(ctx context.Context, sessionID int64, input ChapterMutation) (SessionChapter, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_chapter (
			session_id, arc_id, number, name, description, status, image_id,
			image_focal_x, image_focal_y, position_x, position_y
		 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING id`,
		sessionID, input.ArcID, input.Number, input.Name, input.Description, input.Status,
		input.ImageID, input.ImageFocalX, input.ImageFocalY,
		input.PositionX, input.PositionY,
	).Scan(&id)
	if err != nil {
		return SessionChapter{}, err
	}
	return s.GetChapterByID(ctx, id)
}

func (s *Store) UpdateChapter(ctx context.Context, id int64, input ChapterMutation) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_chapter SET
			arc_id = $2, number = $3, name = $4, description = $5, status = $6,
			image_id = $7, image_focal_x = $8,
			image_focal_y = $9, position_x = $10, position_y = $11
		 WHERE id = $1`,
		id, input.ArcID, input.Number, input.Name, input.Description, input.Status,
		input.ImageID, input.ImageFocalX, input.ImageFocalY,
		input.PositionX, input.PositionY)
	return err
}

func (s *Store) UpdateChapterPosition(ctx context.Context, id int64, x, y float64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_chapter SET position_x = $2, position_y = $3 WHERE id = $1`, id, x, y)
	return err
}

func (s *Store) MoveChapterToArc(ctx context.Context, id, arcID int64, x, y float64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx,
		`DELETE FROM dndshare.session_chapter_edge WHERE from_chapter_id = $1 OR to_chapter_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare.session_chapter SET arc_id = $2, position_x = $3, position_y = $4 WHERE id = $1`,
		id, arcID, x, y); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteChapter(ctx context.Context, sessionID, id int64) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var scenes int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dndshare.session_scene WHERE chapter_id = $1`, id).Scan(&scenes); err != nil {
		return false, err
	}
	if scenes > 0 {
		return false, nil
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare."session" SET current_chapter_id = NULL WHERE id = $1 AND current_chapter_id = $2`, sessionID, id); err != nil {
		return false, err
	}
	result, err := tx.Exec(ctx,
		`DELETE FROM dndshare.session_chapter WHERE id = $1 AND session_id = $2`, id, sessionID)
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) SetCurrentChapter(ctx context.Context, sessionID int64, chapterID *int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if chapterID != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE dndshare.session_chapter SET status = 'in_progress'
			 WHERE id = $1 AND session_id = $2 AND status IN ('draft', 'planned', 'ready', 'available')`,
			*chapterID, sessionID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare."session" SET current_chapter_id = $2, changed_at = now() WHERE id = $1`,
		sessionID, chapterID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) GetChapterEdgesBySession(ctx context.Context, sessionID int64) ([]SessionChapterEdge, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT edge.id, edge.arc_id, edge.from_chapter_id, edge.to_chapter_id, edge.label
		 FROM dndshare.session_chapter_edge edge
		 JOIN dndshare.session_arc arc ON arc.id = edge.arc_id
		 WHERE arc.session_id = $1 ORDER BY edge.id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var edges []SessionChapterEdge
	for rows.Next() {
		var edge SessionChapterEdge
		if err := rows.Scan(&edge.ID, &edge.ArcID, &edge.FromChapterID, &edge.ToChapterID, &edge.Label); err != nil {
			return nil, err
		}
		edges = append(edges, edge)
	}
	return edges, rows.Err()
}

func (s *Store) GetChapterEdge(ctx context.Context, id int64) (SessionChapterEdge, error) {
	var edge SessionChapterEdge
	err := s.pool.QueryRow(ctx,
		`SELECT id, arc_id, from_chapter_id, to_chapter_id, label
		 FROM dndshare.session_chapter_edge WHERE id = $1`, id,
	).Scan(&edge.ID, &edge.ArcID, &edge.FromChapterID, &edge.ToChapterID, &edge.Label)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionChapterEdge{}, ErrNotFound
	}
	return edge, err
}

func (s *Store) CreateChapterEdge(ctx context.Context, arcID, fromID, toID int64, label *string) (SessionChapterEdge, error) {
	var edge SessionChapterEdge
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_chapter_edge (arc_id, from_chapter_id, to_chapter_id, label)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, arc_id, from_chapter_id, to_chapter_id, label`, arcID, fromID, toID, cleanOptional(label),
	).Scan(&edge.ID, &edge.ArcID, &edge.FromChapterID, &edge.ToChapterID, &edge.Label)
	return edge, err
}

func (s *Store) UpdateChapterEdge(ctx context.Context, id, fromID, toID int64, label *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_chapter_edge
		 SET from_chapter_id = $2, to_chapter_id = $3, label = $4 WHERE id = $1`,
		id, fromID, toID, cleanOptional(label))
	return err
}

func (s *Store) DeleteChapterEdge(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_chapter_edge WHERE id = $1`, id)
	return err
}

func cleanOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
