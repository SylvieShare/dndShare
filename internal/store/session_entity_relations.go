package store

import (
	"context"
	"sort"
	"strconv"

	"github.com/jackc/pgx/v5"
)

const (
	SessionEntityLocation = "location"
	SessionEntityNPC      = "npc"
	SessionEntityMaterial = "material"
	SessionEntityQuest    = "quest"
)

func validSessionEntityType(entityType string) bool {
	switch entityType {
	case SessionEntityLocation, SessionEntityNPC, SessionEntityMaterial, SessionEntityQuest:
		return true
	default:
		return false
	}
}

func sessionEntityExistsTx(ctx context.Context, tx pgx.Tx, sessionID int64, entityType string, id int64) (bool, error) {
	if id <= 0 || !validSessionEntityType(entityType) {
		return false, nil
	}
	var table string
	switch entityType {
	case SessionEntityLocation:
		table = "session_location"
	case SessionEntityNPC:
		table = "session_npc"
	case SessionEntityMaterial:
		table = "session_material"
	case SessionEntityQuest:
		table = "session_quest"
	}
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.`+table+` WHERE session_id = $1 AND id = $2)`, sessionID, id).Scan(&exists)
	return exists, err
}

func normalizeSessionEntityRelations(relations []SessionEntityRelation) []SessionEntityRelation {
	result := make([]SessionEntityRelation, 0, len(relations))
	seen := make(map[string]bool, len(relations))
	for _, relation := range relations {
		key := relation.Type + ":" + strconv.FormatInt(relation.ID, 10)
		if relation.ID <= 0 || !validSessionEntityType(relation.Type) || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, relation)
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Type != result[j].Type {
			return result[i].Type < result[j].Type
		}
		return result[i].ID < result[j].ID
	})
	return result
}

func validateSessionEntityRelationsTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID int64,
	sourceType string,
	sourceID int64,
	relations []SessionEntityRelation,
) error {
	if !validSessionEntityType(sourceType) {
		return ErrInvalidWorldReference
	}
	for _, relation := range normalizeSessionEntityRelations(relations) {
		if relation.Type == sourceType && relation.ID == sourceID {
			return ErrInvalidWorldReference
		}
		exists, err := sessionEntityExistsTx(ctx, tx, sessionID, relation.Type, relation.ID)
		if err != nil {
			return err
		}
		if !exists {
			return ErrInvalidWorldReference
		}
	}
	return nil
}

func replaceSessionEntityRelationsTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID int64,
	sourceType string,
	sourceID int64,
	relations []SessionEntityRelation,
) error {
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, sourceType, sourceID, relations); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM dndshare.session_entity_relation
		WHERE session_id = $1
		  AND ((left_type = $2 AND left_id = $3) OR (right_type = $2 AND right_id = $3))`,
		sessionID, sourceType, sourceID); err != nil {
		return err
	}
	for _, relation := range normalizeSessionEntityRelations(relations) {
		leftType, leftID := sourceType, sourceID
		rightType, rightID := relation.Type, relation.ID
		if leftType > rightType || (leftType == rightType && leftID > rightID) {
			leftType, rightType = rightType, leftType
			leftID, rightID = rightID, leftID
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_entity_relation
			    (session_id, left_type, left_id, right_type, right_id, note)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			sessionID, leftType, leftID, rightType, rightID, relation.Note); err != nil {
			return err
		}
	}
	return nil
}

func deleteSessionEntityRelationsTx(ctx context.Context, tx pgx.Tx, sessionID int64, entityType string, id int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM dndshare.session_entity_relation
		WHERE session_id = $1
		  AND ((left_type = $2 AND left_id = $3) OR (right_type = $2 AND right_id = $3))`, sessionID, entityType, id)
	return err
}

func ensureSessionEntityNotUsedBySceneTx(ctx context.Context, tx pgx.Tx, sessionID int64, entityType string, id int64) error {
	var used bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM dndshare.session_scene_item item
			JOIN dndshare.session_scene scene ON scene.id = item.scene_id
			JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
			WHERE chapter.session_id = $1 AND item.type = $2
			  AND item.data ->> 'referenceId' = $3::text
		)`, sessionID, entityType, id).Scan(&used)
	if err != nil {
		return err
	}
	if used {
		return ErrWorldEntityInUse
	}
	return nil
}
