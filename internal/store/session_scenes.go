package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

// SessionScene — строка dndshare.session_scene (порт model/SessionScene.kt).
type SessionScene struct {
	ID              int64   `json:"id"`
	ChapterID       int64   `json:"chapterId"`
	Name            string  `json:"name"`
	Status          string  `json:"status"`
	LocationID      *int64  `json:"locationId"`
	ImageID         *int64  `json:"imageId"`
	ImageURL        string  `json:"imageUrl"`
	ImageCatalogKey *string `json:"imageCatalogKey,omitempty"`
	PositionX       float64 `json:"positionX"`
	PositionY       float64 `json:"positionY"`
}

type SessionSceneEdge struct {
	ID            int64   `json:"id"`
	ChapterID     int64   `json:"chapterId"`
	FromSceneID   int64   `json:"fromSceneId"`
	ToSceneID     int64   `json:"toSceneId"`
	Label         *string `json:"label,omitempty"`
	Bidirectional bool    `json:"bidirectional"`
}

// SessionSceneItem — строка dndshare.session_scene_item (порт model/SessionScene.kt).
type SessionSceneItem struct {
	ID         int64            `json:"id"`
	SceneID    int64            `json:"sceneId"`
	Type       string           `json:"type"`
	Title      string           `json:"title"`
	Data       *json.RawMessage `json:"data,omitempty"`
	PositionX  float64          `json:"positionX"`
	PositionY  float64          `json:"positionY"`
	Width      float64          `json:"width"`
	MaterialID *int64           `json:"materialId,omitempty"`
}

type SessionSceneItemEdge struct {
	ID            int64   `json:"id"`
	SceneID       int64   `json:"sceneId"`
	FromItemID    int64   `json:"fromItemId"`
	ToItemID      int64   `json:"toItemId"`
	Label         *string `json:"label,omitempty"`
	Bidirectional bool    `json:"bidirectional"`
}

// SceneSession — минимум из dndshare."session", нужный контроллеру сцен (id + владелец).
type SceneSession struct {
	ID          int64
	OwnerUserID int64
}

// SceneChapter — минимум из dndshare.session_chapter (id + сессия) для проверки принадлежности.
type SceneChapter struct {
	ID        int64
	SessionID int64
}

// GetSessionByUUIDForScene — активная сессия по uuid (порт GameSessionRepository.getSessionByUuid).
func (s *Store) GetSessionByUUIDForScene(ctx context.Context, uuid string) (SceneSession, error) {
	var ss SceneSession
	err := s.pool.QueryRow(ctx,
		`SELECT id, owner_user_id FROM dndshare."session" WHERE "uuid" = $1 AND deleted = false`, uuid,
	).Scan(&ss.ID, &ss.OwnerUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SceneSession{}, ErrNotFound
	}
	return ss, err
}

// GetSessionChapter — глава по id (порт SessionChapterRepository.getById).
func (s *Store) GetSessionChapter(ctx context.Context, id int64) (SceneChapter, error) {
	var c SceneChapter
	err := s.pool.QueryRow(ctx,
		`SELECT id, session_id FROM dndshare.session_chapter WHERE id = $1`, id,
	).Scan(&c.ID, &c.SessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SceneChapter{}, ErrNotFound
	}
	return c, err
}

func scanScene(row pgx.Row) (SessionScene, error) {
	var sc SessionScene
	err := row.Scan(
		&sc.ID, &sc.ChapterID, &sc.Name, &sc.Status,
		&sc.LocationID, &sc.ImageID, &sc.ImageURL, &sc.ImageCatalogKey, &sc.PositionX, &sc.PositionY,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionScene{}, ErrNotFound
	}
	return sc, err
}

func scanItem(row pgx.Row) (SessionSceneItem, error) {
	var it SessionSceneItem
	var data *[]byte
	err := row.Scan(&it.ID, &it.SceneID, &it.Type, &it.Title, &data, &it.PositionX, &it.PositionY, &it.Width, &it.MaterialID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionSceneItem{}, ErrNotFound
	}
	if err != nil {
		return SessionSceneItem{}, err
	}
	if data != nil {
		raw := json.RawMessage(*data)
		it.Data = &raw
	}
	return it, nil
}

// GetScenesByChapter — сцены главы, порядок по id (порт getByChapter).
func (s *Store) GetScenesByChapter(ctx context.Context, chapterID int64) ([]SessionScene, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT scene.id, scene.chapter_id, scene."name", scene.status,
		        scene.location_id, scene.image_id,
		        COALESCE(scene_image.url, location_image.url, ''), catalog.catalog_key,
		        scene.position_x, scene.position_y
		 FROM dndshare.session_scene scene
		 LEFT JOIN dndshare.session_location location ON location.id = scene.location_id
		 LEFT JOIN dndshare.storage_image scene_image ON scene_image.id = scene.image_id AND scene_image.deleted = false
		 LEFT JOIN dndshare.storage_image location_image ON location_image.id = location.image_id AND location_image.deleted = false
		 LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = COALESCE(scene.image_id, location.image_id)
		 WHERE scene.chapter_id = $1 ORDER BY scene.id`, chapterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionScene
	for rows.Next() {
		sc, err := scanScene(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sc)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSceneByID — сцена по id (порт getSceneById).
func (s *Store) GetSceneByID(ctx context.Context, id int64) (SessionScene, error) {
	scene, err := scanScene(s.pool.QueryRow(ctx,
		`SELECT scene.id, scene.chapter_id, scene."name", scene.status,
		        scene.location_id, scene.image_id,
		        COALESCE(scene_image.url, location_image.url, ''), catalog.catalog_key,
		        scene.position_x, scene.position_y
		 FROM dndshare.session_scene scene
		 LEFT JOIN dndshare.session_location location ON location.id = scene.location_id
		 LEFT JOIN dndshare.storage_image scene_image ON scene_image.id = scene.image_id AND scene_image.deleted = false
		 LEFT JOIN dndshare.storage_image location_image ON location_image.id = location.image_id AND location_image.deleted = false
		 LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = COALESCE(scene.image_id, location.image_id)
		 WHERE scene.id = $1`, id))
	if err != nil {
		return SessionScene{}, err
	}
	return scene, nil
}

// CreateScene — новая сцена (порт createScene).
func (s *Store) CreateScene(ctx context.Context, chapterID int64, name, status string, locationID, imageID *int64, x, y float64) (SessionScene, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene
		    (chapter_id, "name", status, location_id, image_id, position_x, position_y)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		chapterID, name, status, locationID, imageID, x, y,
	).Scan(&id)
	if err != nil {
		return SessionScene{}, err
	}
	return s.GetSceneByID(ctx, id)
}

// UpdateScene updates the editable scenario card fields.
func (s *Store) UpdateScene(ctx context.Context, id int64, name, status string, locationID, imageID *int64) error {
	result, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_scene
		 SET "name" = $1, status = $2, location_id = $3, image_id = $4
		 WHERE id = $5`, name, status, locationID, imageID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdateScenePosition(ctx context.Context, id int64, x, y float64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_scene SET position_x = $2, position_y = $3 WHERE id = $1`, id, x, y)
	return err
}

// DeleteScene — удаление сцены вместе с её айтемами (порт deleteScene). В одной транзакции,
// чтобы сбой между двумя DELETE не оставил сцену без айтемов (или наоборот).
func (s *Store) DeleteScene(ctx context.Context, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx,
		`DELETE FROM dndshare.session_scene_item WHERE scene_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_scene WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetSceneItems — блоки одного сценария.
func (s *Store) GetSceneItems(ctx context.Context, sceneID int64) ([]SessionSceneItem, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, scene_id, "type", title, "data", position_x, position_y, width, material_id
		 FROM dndshare.session_scene_item WHERE scene_id = $1 ORDER BY id`, sceneID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionSceneItem
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// GetSceneItem — айтем по id (порт getItemById).
func (s *Store) GetSceneItem(ctx context.Context, id int64) (SessionSceneItem, error) {
	return scanItem(s.pool.QueryRow(ctx,
		`SELECT id, scene_id, "type", title, "data", position_x, position_y, width, material_id
		 FROM dndshare.session_scene_item WHERE id = $1`, id))
}

// CreateSceneItem — новый блок с координатами на холсте сценария.
func (s *Store) CreateSceneItem(ctx context.Context, sceneID int64, typ, title string, data *string, materialID *int64, x, y, width float64) (SessionSceneItem, error) {
	return scanItem(s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene_item (scene_id, "type", title, "data", material_id, position_x, position_y, width)
		 VALUES ($1, $2, $3, CAST($4 AS jsonb), $5, $6, $7, $8)
		 RETURNING id, scene_id, "type", title, "data", position_x, position_y, width, material_id`,
		sceneID, typ, title, data, materialID, x, y, width))
}

// UpdateSceneItem — частичное обновление айтема (порт updateItem).
func (s *Store) UpdateSceneItem(ctx context.Context, id int64, title *string, data *string, dataChanged bool, materialID *int64, materialChanged bool, positionX, positionY, width *float64) error {
	var sets []string
	var args []any
	n := 1
	add := func(clause string, val any) {
		sets = append(sets, clause)
		args = append(args, val)
		n++
	}
	if title != nil {
		add("title = $"+strconv.Itoa(n), *title)
	}
	if dataChanged {
		sets = append(sets, `"data" = CAST($`+strconv.Itoa(n)+` AS jsonb)`)
		args = append(args, data)
		n++
	}
	if materialChanged {
		add("material_id = $"+strconv.Itoa(n), materialID)
	}
	if positionX != nil {
		add("position_x = $"+strconv.Itoa(n), *positionX)
	}
	if positionY != nil {
		add("position_y = $"+strconv.Itoa(n), *positionY)
	}
	if width != nil {
		add("width = $"+strconv.Itoa(n), *width)
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, id)
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_scene_item SET `+strings.Join(sets, ", ")+` WHERE id = $`+strconv.Itoa(n), args...)
	return err
}

// DeleteSceneItem — удаление айтема (порт deleteItem).
func (s *Store) DeleteSceneItem(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_scene_item WHERE id = $1`, id)
	return err
}

func scanSceneEdge(row pgx.Row) (SessionSceneEdge, error) {
	var edge SessionSceneEdge
	err := row.Scan(&edge.ID, &edge.ChapterID, &edge.FromSceneID, &edge.ToSceneID, &edge.Label, &edge.Bidirectional)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionSceneEdge{}, ErrNotFound
	}
	return edge, err
}

func (s *Store) GetSceneEdgesByChapter(ctx context.Context, chapterID int64) ([]SessionSceneEdge, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, chapter_id, from_scene_id, to_scene_id, label, bidirectional
		 FROM dndshare.session_scene_edge WHERE chapter_id = $1 ORDER BY id`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var edges []SessionSceneEdge
	for rows.Next() {
		var edge SessionSceneEdge
		if err := rows.Scan(&edge.ID, &edge.ChapterID, &edge.FromSceneID, &edge.ToSceneID, &edge.Label, &edge.Bidirectional); err != nil {
			return nil, err
		}
		edges = append(edges, edge)
	}
	return edges, rows.Err()
}

func (s *Store) GetSceneEdge(ctx context.Context, id int64) (SessionSceneEdge, error) {
	return scanSceneEdge(s.pool.QueryRow(ctx,
		`SELECT id, chapter_id, from_scene_id, to_scene_id, label, bidirectional
		 FROM dndshare.session_scene_edge WHERE id = $1`, id))
}

func (s *Store) CreateSceneEdge(ctx context.Context, chapterID, fromID, toID int64, label *string, bidirectional bool) (SessionSceneEdge, error) {
	return scanSceneEdge(s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene_edge (chapter_id, from_scene_id, to_scene_id, label, bidirectional)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, chapter_id, from_scene_id, to_scene_id, label, bidirectional`, chapterID, fromID, toID, cleanOptional(label), bidirectional))
}

func (s *Store) UpdateSceneEdge(ctx context.Context, id, fromID, toID int64, label *string, bidirectional bool) (SessionSceneEdge, error) {
	return scanSceneEdge(s.pool.QueryRow(ctx,
		`UPDATE dndshare.session_scene_edge
		 SET from_scene_id = $2, to_scene_id = $3, label = $4, bidirectional = $5 WHERE id = $1
		 RETURNING id, chapter_id, from_scene_id, to_scene_id, label, bidirectional`, id, fromID, toID, cleanOptional(label), bidirectional))
}

func (s *Store) DeleteSceneEdge(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_scene_edge WHERE id = $1`, id)
	return err
}

func scanSceneItemEdge(row pgx.Row) (SessionSceneItemEdge, error) {
	var edge SessionSceneItemEdge
	err := row.Scan(&edge.ID, &edge.SceneID, &edge.FromItemID, &edge.ToItemID, &edge.Label, &edge.Bidirectional)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionSceneItemEdge{}, ErrNotFound
	}
	return edge, err
}

func (s *Store) GetSceneItemEdges(ctx context.Context, sceneID int64) ([]SessionSceneItemEdge, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, scene_id, from_item_id, to_item_id, label, bidirectional
		 FROM dndshare.session_scene_item_edge WHERE scene_id = $1 ORDER BY id`, sceneID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var edges []SessionSceneItemEdge
	for rows.Next() {
		var edge SessionSceneItemEdge
		if err := rows.Scan(&edge.ID, &edge.SceneID, &edge.FromItemID, &edge.ToItemID, &edge.Label, &edge.Bidirectional); err != nil {
			return nil, err
		}
		edges = append(edges, edge)
	}
	return edges, rows.Err()
}

func (s *Store) GetSceneItemEdge(ctx context.Context, id int64) (SessionSceneItemEdge, error) {
	return scanSceneItemEdge(s.pool.QueryRow(ctx,
		`SELECT id, scene_id, from_item_id, to_item_id, label, bidirectional
		 FROM dndshare.session_scene_item_edge WHERE id = $1`, id))
}

func (s *Store) CreateSceneItemEdge(ctx context.Context, sceneID, fromID, toID int64, label *string, bidirectional bool) (SessionSceneItemEdge, error) {
	return scanSceneItemEdge(s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene_item_edge (scene_id, from_item_id, to_item_id, label, bidirectional)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, scene_id, from_item_id, to_item_id, label, bidirectional`, sceneID, fromID, toID, cleanOptional(label), bidirectional))
}

func (s *Store) UpdateSceneItemEdge(ctx context.Context, id, fromID, toID int64, label *string, bidirectional bool) (SessionSceneItemEdge, error) {
	return scanSceneItemEdge(s.pool.QueryRow(ctx,
		`UPDATE dndshare.session_scene_item_edge
		 SET from_item_id = $2, to_item_id = $3, label = $4, bidirectional = $5 WHERE id = $1
		 RETURNING id, scene_id, from_item_id, to_item_id, label, bidirectional`, id, fromID, toID, cleanOptional(label), bidirectional))
}

func (s *Store) DeleteSceneItemEdge(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_scene_item_edge WHERE id = $1`, id)
	return err
}
