package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CharacterEditionMatchesTemplate(ctx context.Context, templateID, editionID int64) (bool, error) {
	var valid bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.char_template t JOIN dndshare.source_version v ON v.id=$2 JOIN dndshare.source s ON s.id=v.source_id WHERE t.id=$1 AND ((upper(t.name)='DND5' AND lower(s.name)='dnd5e') OR (upper(t.name)='VTM20' AND lower(s.name)='vampire: tm')))`, templateID, editionID).Scan(&valid)
	return valid, err
}
func (s *Store) CloneOwnCharacter(ctx context.Context, userID, originalID int64, data json.RawMessage) (string, error) {
	var uuid string
	err := s.pool.QueryRow(ctx, `INSERT INTO dndshare."char"(user_id,template_id,source_version_id,data,public_visible,cloned_from_char_id) SELECT user_id,template_id,source_version_id,$3::jsonb,false,id FROM dndshare."char" WHERE id=$1 AND user_id=$2 AND NOT deleted RETURNING uuid::text`, originalID, userID, string(data)).Scan(&uuid)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return uuid, err
}
