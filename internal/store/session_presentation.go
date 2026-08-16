package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type SessionMaterial struct {
	ID          int64     `json:"id"`
	SessionID   int64     `json:"sessionId"`
	Scope       string    `json:"scope"`
	ChapterID   *int64    `json:"chapterId,omitempty"`
	ChapterName *string   `json:"chapterName,omitempty"`
	SceneID     *int64    `json:"sceneId,omitempty"`
	SceneName   *string   `json:"sceneName,omitempty"`
	Kind        string    `json:"kind"`
	Name        string    `json:"name"`
	Caption     *string   `json:"caption,omitempty"`
	ImageID     int64     `json:"imageId"`
	ImageURL    string    `json:"imageUrl"`
	CreatedAt   time.Time `json:"createdAt"`
	ChangedAt   time.Time `json:"changedAt"`
}

type SessionMaterialContext struct {
	Chapters []SessionMaterialChapter `json:"chapters"`
	Scenes   []SessionMaterialScene   `json:"scenes"`
}

type SessionMaterialChapter struct {
	ID     int64  `json:"id"`
	Number string `json:"number"`
	Name   string `json:"name"`
}

type SessionMaterialScene struct {
	ID        int64  `json:"id"`
	ChapterID int64  `json:"chapterId"`
	Name      string `json:"name"`
}

type SessionPresentationState struct {
	SessionID  int64            `json:"sessionId"`
	Mode       string           `json:"mode"`
	Visible    bool             `json:"visible"`
	MaterialID *int64           `json:"materialId,omitempty"`
	Material   *SessionMaterial `json:"material,omitempty"`
	SceneID    *int64           `json:"sceneId,omitempty"`
	Scene      *SessionScene    `json:"scene,omitempty"`
	Effect     string           `json:"effect"`
	Transition string           `json:"transition"`
	Revision   int64            `json:"revision"`
	ChangedAt  time.Time        `json:"changedAt"`
}

func scanSessionMaterial(row pgx.Row) (SessionMaterial, error) {
	var material SessionMaterial
	err := row.Scan(
		&material.ID, &material.SessionID, &material.Scope,
		&material.ChapterID, &material.ChapterName, &material.SceneID, &material.SceneName,
		&material.Kind, &material.Name, &material.Caption,
		&material.ImageID, &material.ImageURL, &material.CreatedAt, &material.ChangedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionMaterial{}, ErrNotFound
	}
	return material, err
}

const sessionMaterialSelect = `
	SELECT material.id, material.session_id, material.scope,
	       material.chapter_id, chapter."name", material.scene_id, scene."name",
	       material.kind, material."name", material.caption,
	       material.image_id, COALESCE(image.url, ''), material.created_at, material.changed_at
	FROM dndshare.session_material material
	JOIN dndshare.storage_image image ON image.id = material.image_id AND image.deleted = false
	LEFT JOIN dndshare.session_chapter chapter ON chapter.id = material.chapter_id
	LEFT JOIN dndshare.session_scene scene ON scene.id = material.scene_id`

func (s *Store) ListSessionMaterials(ctx context.Context, sessionID int64) ([]SessionMaterial, error) {
	rows, err := s.pool.Query(ctx, sessionMaterialSelect+`
		WHERE material.session_id = $1
		ORDER BY CASE material.scope WHEN 'session' THEN 0 WHEN 'chapter' THEN 1 ELSE 2 END,
		         lower(material."name"), material.id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	materials := []SessionMaterial{}
	for rows.Next() {
		material, err := scanSessionMaterial(rows)
		if err != nil {
			return nil, err
		}
		materials = append(materials, material)
	}
	return materials, rows.Err()
}

func (s *Store) GetSessionMaterial(ctx context.Context, id int64) (SessionMaterial, error) {
	return scanSessionMaterial(s.pool.QueryRow(ctx, sessionMaterialSelect+` WHERE material.id = $1`, id))
}

func (s *Store) CreateSessionMaterial(
	ctx context.Context,
	sessionID int64,
	scope string,
	chapterID, sceneID *int64,
	name string,
	caption *string,
	imageID int64,
) (SessionMaterial, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.session_material
		    (session_id, scope, chapter_id, scene_id, kind, "name", caption, image_id)
		VALUES ($1, $2, $3, $4, 'image', $5, $6, $7)
		RETURNING id`, sessionID, scope, chapterID, sceneID, name, caption, imageID).Scan(&id)
	if err != nil {
		return SessionMaterial{}, err
	}
	return s.GetSessionMaterial(ctx, id)
}

func (s *Store) UpdateSessionMaterial(
	ctx context.Context,
	id int64,
	scope string,
	chapterID, sceneID *int64,
	name string,
	caption *string,
	imageID int64,
) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dndshare.session_material
		SET scope = $2, chapter_id = $3, scene_id = $4, "name" = $5,
		    caption = $6, image_id = $7, changed_at = now()
		WHERE id = $1`, id, scope, chapterID, sceneID, name, caption, imageID)
	return err
}

func (s *Store) DeleteSessionMaterial(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_material WHERE id = $1`, id)
	return err
}

func (s *Store) GetSessionMaterialContexts(ctx context.Context, sessionID int64) (SessionMaterialContext, error) {
	result := SessionMaterialContext{Chapters: []SessionMaterialChapter{}, Scenes: []SessionMaterialScene{}}
	chapterRows, err := s.pool.Query(ctx, `
		SELECT chapter.id, chapter.number, chapter."name"
		FROM dndshare.session_chapter chapter
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.number, chapter.id`, sessionID)
	if err != nil {
		return result, err
	}
	for chapterRows.Next() {
		var chapter SessionMaterialChapter
		if err := chapterRows.Scan(&chapter.ID, &chapter.Number, &chapter.Name); err != nil {
			chapterRows.Close()
			return result, err
		}
		result.Chapters = append(result.Chapters, chapter)
	}
	if err := chapterRows.Err(); err != nil {
		chapterRows.Close()
		return result, err
	}
	chapterRows.Close()

	sceneRows, err := s.pool.Query(ctx, `
		SELECT scene.id, scene.chapter_id, scene."name"
		FROM dndshare.session_scene scene
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.number, scene.id`, sessionID)
	if err != nil {
		return result, err
	}
	defer sceneRows.Close()
	for sceneRows.Next() {
		var scene SessionMaterialScene
		if err := sceneRows.Scan(&scene.ID, &scene.ChapterID, &scene.Name); err != nil {
			return result, err
		}
		result.Scenes = append(result.Scenes, scene)
	}
	return result, sceneRows.Err()
}

func (s *Store) GetSessionPresentation(ctx context.Context, sessionID int64) (SessionPresentationState, error) {
	state := SessionPresentationState{SessionID: sessionID, Mode: "idle", Effect: "none", Transition: "fade"}
	err := s.pool.QueryRow(ctx, `
		SELECT mode, visible, material_id, scene_id, effect, transition, revision, changed_at
		FROM dndshare.session_presentation_state WHERE session_id = $1`, sessionID,
	).Scan(&state.Mode, &state.Visible, &state.MaterialID, &state.SceneID, &state.Effect, &state.Transition, &state.Revision, &state.ChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		state.ChangedAt = time.Now()
	} else if err != nil {
		return state, err
	}
	if state.MaterialID != nil {
		material, lookupErr := s.GetSessionMaterial(ctx, *state.MaterialID)
		if lookupErr == nil {
			state.Material = &material
		} else if !errors.Is(lookupErr, ErrNotFound) {
			return state, lookupErr
		}
	}
	if state.SceneID != nil {
		scene, lookupErr := s.GetSceneByID(ctx, *state.SceneID)
		if lookupErr == nil {
			state.Scene = &scene
		} else if !errors.Is(lookupErr, ErrNotFound) {
			return state, lookupErr
		}
	}
	return state, nil
}

func (s *Store) SaveSessionPresentation(
	ctx context.Context,
	sessionID int64,
	mode string,
	visible bool,
	materialID, sceneID *int64,
	effect, transition string,
) (SessionPresentationState, error) {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO dndshare.session_presentation_state
		    (session_id, mode, visible, material_id, scene_id, effect, transition, revision)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
		ON CONFLICT (session_id) DO UPDATE SET
		    mode = EXCLUDED.mode, visible = EXCLUDED.visible,
		    material_id = EXCLUDED.material_id, scene_id = EXCLUDED.scene_id,
		    effect = EXCLUDED.effect, transition = EXCLUDED.transition,
		    revision = dndshare.session_presentation_state.revision + 1,
		    changed_at = now()`, sessionID, mode, visible, materialID, sceneID, effect, transition)
	if err != nil {
		return SessionPresentationState{}, err
	}
	return s.GetSessionPresentation(ctx, sessionID)
}

func (s *Store) SetCombatPresentationActive(ctx context.Context, sessionID int64, active bool) error {
	if active {
		_, err := s.pool.Exec(ctx, `
			INSERT INTO dndshare.session_presentation_state
			    (session_id, mode, visible, effect, transition, revision)
			VALUES ($1, 'combat', true, 'none', 'fade', 1)
			ON CONFLICT (session_id) DO UPDATE SET
			    mode = 'combat', visible = true, material_id = NULL, scene_id = NULL,
			    effect = 'none', transition = 'fade',
			    revision = dndshare.session_presentation_state.revision + 1,
			    changed_at = now()`, sessionID)
		return err
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE dndshare.session_presentation_state
		SET visible = false, revision = revision + 1, changed_at = now()
		WHERE session_id = $1 AND mode = 'combat'`, sessionID)
	return err
}
