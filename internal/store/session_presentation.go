package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type SessionMaterial struct {
	ID           int64                        `json:"id"`
	SessionID    int64                        `json:"sessionId"`
	Kind         string                       `json:"kind"`
	Name         string                       `json:"name"`
	Caption      *string                      `json:"caption,omitempty"`
	Content      *string                      `json:"content,omitempty"`
	NoteStyle    *string                      `json:"noteStyle,omitempty"`
	AssetID      *int64                       `json:"assetId,omitempty"`
	AssetURL     string                       `json:"assetUrl,omitempty"`
	ChapterLinks []SessionMaterialChapterLink `json:"chapterLinks"`
	SceneLinks   []SessionMaterialSceneLink   `json:"sceneLinks"`
	Relations    []SessionEntityRelation      `json:"relations"`
	CreatedAt    time.Time                    `json:"createdAt"`
	ChangedAt    time.Time                    `json:"changedAt"`
}

type SessionMaterialChapterLink struct {
	ChapterID int64   `json:"chapterId"`
	Note      *string `json:"note,omitempty"`
}

type SessionMaterialSceneLink struct {
	SceneID int64   `json:"sceneId"`
	Note    *string `json:"note,omitempty"`
}

type SessionMaterialContext struct {
	Chapters []SessionMaterialChapter `json:"chapters"`
	Scenes   []SessionMaterialScene   `json:"scenes"`
}

type SessionMaterialChapter struct {
	ID       int64  `json:"id"`
	Number   string `json:"number"`
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl,omitempty"`
}

type SessionMaterialScene struct {
	ID        int64  `json:"id"`
	ChapterID int64  `json:"chapterId"`
	Name      string `json:"name"`
	ImageURL  string `json:"imageUrl,omitempty"`
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
		&material.ID, &material.SessionID, &material.Kind, &material.Name, &material.Caption, &material.Content, &material.NoteStyle,
		&material.AssetID, &material.AssetURL, &material.CreatedAt, &material.ChangedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionMaterial{}, ErrNotFound
	}
	return material, err
}

const sessionMaterialSelect = `
	SELECT material.id, material.session_id, material.kind, material."name",
	       material.caption, material.content, material.note_style,
	       material.asset_id, COALESCE(asset.url, ''), material.created_at, material.changed_at
	FROM dndshare.session_material material
	LEFT JOIN dndshare.storage_image asset ON asset.id = material.asset_id AND asset.deleted = false`

func (s *Store) ListSessionMaterials(ctx context.Context, sessionID int64) ([]SessionMaterial, error) {
	rows, err := s.pool.Query(ctx, sessionMaterialSelect+`
		WHERE material.session_id = $1
		ORDER BY lower(material."name"), material.id`, sessionID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	if err := s.loadSessionMaterialLinks(ctx, sessionID, materials); err != nil {
		return nil, err
	}
	return materials, nil
}

func (s *Store) GetSessionMaterial(ctx context.Context, id int64) (SessionMaterial, error) {
	material, err := scanSessionMaterial(s.pool.QueryRow(ctx, sessionMaterialSelect+` WHERE material.id = $1`, id))
	if err != nil {
		return material, err
	}
	items := []SessionMaterial{material}
	if err := s.loadSessionMaterialLinks(ctx, material.SessionID, items); err != nil {
		return SessionMaterial{}, err
	}
	return items[0], nil
}

func (s *Store) loadSessionMaterialLinks(ctx context.Context, sessionID int64, materials []SessionMaterial) error {
	if len(materials) == 0 {
		return nil
	}
	byID := make(map[int64]*SessionMaterial, len(materials))
	for index := range materials {
		materials[index].ChapterLinks = []SessionMaterialChapterLink{}
		materials[index].SceneLinks = []SessionMaterialSceneLink{}
		materials[index].Relations = []SessionEntityRelation{}
		byID[materials[index].ID] = &materials[index]
	}
	whereSQL := "material.session_id = $1"
	whereArg := sessionID
	if len(materials) == 1 {
		whereSQL = "link.material_id = $1"
		whereArg = materials[0].ID
	}
	chapterRows, err := s.pool.Query(ctx, `
		SELECT link.material_id, link.chapter_id, link.note
		FROM dndshare.session_material_chapter link
		JOIN dndshare.session_material material ON material.id = link.material_id
		WHERE `+whereSQL+`
		ORDER BY link.material_id, link.chapter_id`, whereArg)
	if err != nil {
		return err
	}
	for chapterRows.Next() {
		var materialID int64
		var link SessionMaterialChapterLink
		if err := chapterRows.Scan(&materialID, &link.ChapterID, &link.Note); err != nil {
			chapterRows.Close()
			return err
		}
		if material := byID[materialID]; material != nil {
			material.ChapterLinks = append(material.ChapterLinks, link)
		}
	}
	if err := chapterRows.Err(); err != nil {
		chapterRows.Close()
		return err
	}
	chapterRows.Close()

	sceneRows, err := s.pool.Query(ctx, `
		SELECT link.material_id, link.scene_id, link.note
		FROM dndshare.session_material_scene link
		JOIN dndshare.session_material material ON material.id = link.material_id
		WHERE `+whereSQL+`
		ORDER BY link.material_id, link.scene_id`, whereArg)
	if err != nil {
		return err
	}
	for sceneRows.Next() {
		var materialID int64
		var link SessionMaterialSceneLink
		if err := sceneRows.Scan(&materialID, &link.SceneID, &link.Note); err != nil {
			return err
		}
		if material := byID[materialID]; material != nil {
			material.SceneLinks = append(material.SceneLinks, link)
		}
	}
	if err := sceneRows.Err(); err != nil {
		sceneRows.Close()
		return err
	}
	sceneRows.Close()
	return s.loadSessionMaterialEntityRelations(ctx, sessionID, materials, byID)
}

func (s *Store) loadSessionMaterialEntityRelations(
	ctx context.Context,
	sessionID int64,
	materials []SessionMaterial,
	byID map[int64]*SessionMaterial,
) error {
	ids := make([]int64, 0, len(materials))
	for _, material := range materials {
		ids = append(ids, material.ID)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT left_type, left_id, right_type, right_id, note
		FROM dndshare.session_entity_relation
		WHERE session_id = $1
		  AND ((left_type = 'material' AND left_id = ANY($2::bigint[]))
		    OR (right_type = 'material' AND right_id = ANY($2::bigint[])))
		ORDER BY left_type, left_id, right_type, right_id`, sessionID, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var leftType, rightType string
		var leftID, rightID int64
		var note *string
		if err := rows.Scan(&leftType, &leftID, &rightType, &rightID, &note); err != nil {
			return err
		}
		if leftType == SessionEntityMaterial {
			if material := byID[leftID]; material != nil {
				material.Relations = append(material.Relations, SessionEntityRelation{Type: rightType, ID: rightID, Note: note})
			}
		}
		if rightType == SessionEntityMaterial {
			if material := byID[rightID]; material != nil {
				material.Relations = append(material.Relations, SessionEntityRelation{Type: leftType, ID: leftID, Note: note})
			}
		}
	}
	return rows.Err()
}

func (s *Store) CreateSessionMaterial(
	ctx context.Context,
	sessionID int64,
	kind, name string,
	caption, content, noteStyle *string,
	assetID *int64,
	chapterLinks []SessionMaterialChapterLink,
	sceneLinks []SessionMaterialSceneLink,
	relations []SessionEntityRelation,
) (SessionMaterial, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionMaterial{}, err
	}
	defer tx.Rollback(ctx)
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.session_material
		    (session_id, kind, "name", caption, content, note_style, asset_id, map_data)
		VALUES ($1, $2, $3, $4, $5, $6, $7,
		        CASE WHEN $2 = 'map' THEN '{}'::jsonb ELSE NULL END)
		RETURNING id`, sessionID, kind, name, caption, content, noteStyle, assetID).Scan(&id)
	if err != nil {
		return SessionMaterial{}, err
	}
	if err := replaceSessionMaterialLinks(ctx, tx, id, chapterLinks, sceneLinks); err != nil {
		return SessionMaterial{}, err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityMaterial, id, relations); err != nil {
		return SessionMaterial{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SessionMaterial{}, err
	}
	return s.GetSessionMaterial(ctx, id)
}

func (s *Store) UpdateSessionMaterial(
	ctx context.Context,
	sessionID, id int64,
	kind, name string,
	caption, content, noteStyle *string,
	assetID *int64,
	chapterLinks []SessionMaterialChapterLink,
	sceneLinks []SessionMaterialSceneLink,
	relations []SessionEntityRelation,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.session_material
		SET kind = $2, "name" = $3, caption = $4, content = $5, note_style = $6, asset_id = $7,
		    map_data = CASE WHEN $2 = 'map' THEN COALESCE(map_data, '{}'::jsonb) ELSE NULL END,
		    changed_at = now()
		WHERE id = $1`, id, kind, name, caption, content, noteStyle, assetID); err != nil {
		return err
	}
	if err := replaceSessionMaterialLinks(ctx, tx, id, chapterLinks, sceneLinks); err != nil {
		return err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityMaterial, id, relations); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func replaceSessionMaterialLinks(
	ctx context.Context,
	tx pgx.Tx,
	materialID int64,
	chapterLinks []SessionMaterialChapterLink,
	sceneLinks []SessionMaterialSceneLink,
) error {
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_material_chapter WHERE material_id = $1`, materialID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_material_scene WHERE material_id = $1`, materialID); err != nil {
		return err
	}
	for _, link := range chapterLinks {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_material_chapter (material_id, chapter_id, note)
			VALUES ($1, $2, $3)`, materialID, link.ChapterID, link.Note); err != nil {
			return err
		}
	}
	for _, link := range sceneLinks {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_material_scene (material_id, scene_id, note)
			VALUES ($1, $2, $3)`, materialID, link.SceneID, link.Note); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteSessionMaterial(ctx context.Context, sessionID, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := deleteSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityMaterial, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_material WHERE id = $1 AND session_id = $2`, id, sessionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) GetSessionMaterialContexts(ctx context.Context, sessionID int64) (SessionMaterialContext, error) {
	result := SessionMaterialContext{Chapters: []SessionMaterialChapter{}, Scenes: []SessionMaterialScene{}}
	chapterRows, err := s.pool.Query(ctx, `
		SELECT chapter.id, chapter.number, chapter."name", COALESCE(image.url, '')
		FROM dndshare.session_chapter chapter
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		LEFT JOIN dndshare.storage_image image ON image.id = chapter.image_id AND image.deleted = false
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.number, chapter.id`, sessionID)
	if err != nil {
		return result, err
	}
	for chapterRows.Next() {
		var chapter SessionMaterialChapter
		if err := chapterRows.Scan(&chapter.ID, &chapter.Number, &chapter.Name, &chapter.ImageURL); err != nil {
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
		SELECT scene.id, scene.chapter_id, scene."name", COALESCE(image.url, '')
		FROM dndshare.session_scene scene
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		LEFT JOIN dndshare.storage_image image ON image.id = scene.image_id AND image.deleted = false
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.number, scene.id`, sessionID)
	if err != nil {
		return result, err
	}
	defer sceneRows.Close()
	for sceneRows.Next() {
		var scene SessionMaterialScene
		if err := sceneRows.Scan(&scene.ID, &scene.ChapterID, &scene.Name, &scene.ImageURL); err != nil {
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
