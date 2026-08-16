package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type SessionMaterial struct {
	ID        int64                   `json:"id"`
	SessionID int64                   `json:"sessionId"`
	Kind      string                  `json:"kind"`
	Name      string                  `json:"name"`
	Caption   *string                 `json:"caption,omitempty"`
	Content   *string                 `json:"content,omitempty"`
	NoteStyle *string                 `json:"noteStyle,omitempty"`
	AssetID   *int64                  `json:"assetId,omitempty"`
	AssetURL  string                  `json:"assetUrl,omitempty"`
	Relations []SessionEntityRelation `json:"relations"`
	CreatedAt time.Time               `json:"createdAt"`
	ChangedAt time.Time               `json:"changedAt"`
}

type SessionPresentationState struct {
	SessionID      int64            `json:"sessionId"`
	Mode           string           `json:"mode"`
	Visible        bool             `json:"visible"`
	MaterialID     *int64           `json:"materialId,omitempty"`
	Material       *SessionMaterial `json:"material,omitempty"`
	BroadcastMusic bool             `json:"broadcastMusic"`
	Effect         string           `json:"effect"`
	Transition     string           `json:"transition"`
	Revision       int64            `json:"revision"`
	ChangedAt      time.Time        `json:"changedAt"`
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
	if err := s.loadSessionMaterialRelations(ctx, sessionID, materials); err != nil {
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
	if err := s.loadSessionMaterialRelations(ctx, material.SessionID, items); err != nil {
		return SessionMaterial{}, err
	}
	return items[0], nil
}

func (s *Store) loadSessionMaterialRelations(ctx context.Context, sessionID int64, materials []SessionMaterial) error {
	if len(materials) == 0 {
		return nil
	}
	byID := make(map[int64]*SessionMaterial, len(materials))
	for index := range materials {
		materials[index].Relations = []SessionEntityRelation{}
		byID[materials[index].ID] = &materials[index]
	}
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
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityMaterial, id, relations); err != nil {
		return err
	}
	return tx.Commit(ctx)
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

func (s *Store) GetSessionPresentation(ctx context.Context, sessionID int64) (SessionPresentationState, error) {
	state := SessionPresentationState{SessionID: sessionID, Mode: "idle", Effect: "none", Transition: "fade"}
	err := s.pool.QueryRow(ctx, `
		SELECT mode, visible, material_id, broadcast_music, effect, transition, revision, changed_at
		FROM dndshare.session_presentation_state WHERE session_id = $1`, sessionID,
	).Scan(&state.Mode, &state.Visible, &state.MaterialID, &state.BroadcastMusic, &state.Effect, &state.Transition, &state.Revision, &state.ChangedAt)
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
	return state, nil
}

func (s *Store) SaveSessionPresentation(
	ctx context.Context,
	sessionID int64,
	mode string,
	visible bool,
	materialID *int64,
	broadcastMusic bool,
	effect, transition string,
) (SessionPresentationState, error) {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO dndshare.session_presentation_state
		    (session_id, mode, visible, material_id, broadcast_music, effect, transition, revision)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
		ON CONFLICT (session_id) DO UPDATE SET
		    mode = EXCLUDED.mode, visible = EXCLUDED.visible,
		    material_id = EXCLUDED.material_id, broadcast_music = EXCLUDED.broadcast_music,
		    effect = EXCLUDED.effect, transition = EXCLUDED.transition,
		    revision = dndshare.session_presentation_state.revision + 1,
		    changed_at = now()`, sessionID, mode, visible, materialID, broadcastMusic, effect, transition)
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
			    mode = 'combat', visible = true, material_id = NULL,
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
