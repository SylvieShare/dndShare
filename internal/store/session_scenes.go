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
	ID        int64  `json:"id"`
	ChapterID int64  `json:"chapterId"`
	Name      string `json:"name"`
}

// SessionSceneItem — строка dndshare.session_scene_item (порт model/SessionScene.kt).
type SessionSceneItem struct {
	ID      int64            `json:"id"`
	SceneID int64            `json:"sceneId"`
	Type    string           `json:"type"`
	Title   string           `json:"title"`
	Data    *json.RawMessage `json:"data,omitempty"`
	Color   *string          `json:"color,omitempty"`
	Order   int64            `json:"order"`
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
	err := row.Scan(&sc.ID, &sc.ChapterID, &sc.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionScene{}, ErrNotFound
	}
	return sc, err
}

func scanItem(row pgx.Row) (SessionSceneItem, error) {
	var it SessionSceneItem
	var data *[]byte
	var color *string
	err := row.Scan(&it.ID, &it.SceneID, &it.Type, &it.Title, &data, &color, &it.Order)
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
	it.Color = color
	return it, nil
}

// GetScenesByChapter — сцены главы, порядок по id (порт getByChapter).
func (s *Store) GetScenesByChapter(ctx context.Context, chapterID int64) ([]SessionScene, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, chapter_id, "name" FROM dndshare.session_scene WHERE chapter_id = $1 ORDER BY id`, chapterID,
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
	return out, rows.Err()
}

// GetSceneByID — сцена по id (порт getSceneById).
func (s *Store) GetSceneByID(ctx context.Context, id int64) (SessionScene, error) {
	return scanScene(s.pool.QueryRow(ctx,
		`SELECT id, chapter_id, "name" FROM dndshare.session_scene WHERE id = $1`, id))
}

// CreateScene — новая сцена (порт createScene).
func (s *Store) CreateScene(ctx context.Context, chapterID int64, name string) (SessionScene, error) {
	return scanScene(s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene (chapter_id, "name") VALUES ($1, $2)
		 RETURNING id, chapter_id, "name"`, chapterID, name))
}

// RenameScene — переименование сцены (порт renameScene).
func (s *Store) RenameScene(ctx context.Context, id int64, name string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_scene SET "name" = $1 WHERE id = $2`, name, id)
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

// GetSceneItems — айтемы сцены, порядок по order,id (порт getItemsByScene).
func (s *Store) GetSceneItems(ctx context.Context, sceneID int64) ([]SessionSceneItem, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, scene_id, "type", title, "data", color, "order"
		 FROM dndshare.session_scene_item WHERE scene_id = $1 ORDER BY "order", id`, sceneID,
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
		`SELECT id, scene_id, "type", title, "data", color, "order"
		 FROM dndshare.session_scene_item WHERE id = $1`, id))
}

// CreateSceneItem — новый айтем, order = max+1 (порт createItem).
func (s *Store) CreateSceneItem(ctx context.Context, sceneID int64, typ, title string, data *string, color *string) (SessionSceneItem, error) {
	return scanItem(s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_scene_item (scene_id, "type", title, "data", color, "order")
		 VALUES ($1, $2, $3, CAST($4 AS jsonb), $5,
		         (SELECT COALESCE(MAX("order"), 0) + 1 FROM dndshare.session_scene_item WHERE scene_id = $1))
		 RETURNING id, scene_id, "type", title, "data", color, "order"`,
		sceneID, typ, title, data, color))
}

// UpdateSceneItem — частичное обновление айтема (порт updateItem).
func (s *Store) UpdateSceneItem(ctx context.Context, id int64, title *string, data *string, dataChanged bool, color *string, colorChanged bool, order *int64) error {
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
	if colorChanged {
		add("color = $"+strconv.Itoa(n), color)
	}
	if order != nil {
		add(`"order" = $`+strconv.Itoa(n), *order)
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
