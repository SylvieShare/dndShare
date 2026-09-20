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

var ErrCharacterEdition = errors.New("выберите редакцию той же игровой системы")

// ChangeCharacterEdition preserves the document and all concrete item references.
// The row lock serializes this operation with autosave and inventory mutations.
func (s *Store) ChangeCharacterEdition(ctx context.Context, userID int64, uuid string, version, targetID int64) (CharacterItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CharacterItem{}, err
	}
	defer tx.Rollback(ctx)
	query := `SELECT ` + characterCols + ` FROM dndshare."char" c LEFT JOIN dndshare.source_version sv ON sv.id=c.source_version_id LEFT JOIN dndshare.source src ON src.id=sv.source_id WHERE c.uuid=$1::uuid AND c.user_id=$2 AND NOT c.deleted`
	current, err := scanCharacter(tx.QueryRow(ctx, query+` FOR UPDATE OF c`, uuid, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return CharacterItem{}, ErrNotFound
	}
	if err != nil {
		return CharacterItem{}, err
	}
	if current.Version != version {
		return CharacterItem{}, ErrCharacterVersion
	}
	var sourceID int64
	err = tx.QueryRow(ctx, `SELECT source_id FROM dndshare.source_version WHERE id=$1`, targetID).Scan(&sourceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CharacterItem{}, ErrCharacterEdition
	}
	if err != nil {
		return CharacterItem{}, err
	}
	if current.SourceID == nil || *current.SourceID != sourceID {
		return CharacterItem{}, ErrCharacterEdition
	}
	if current.SourceVersionID == nil || *current.SourceVersionID != targetID {
		if _, err = tx.Exec(ctx, `UPDATE dndshare."char" SET source_version_id=$1,changed_at=now(),"version"="version"+1 WHERE id=$2`, targetID, current.ID); err != nil {
			return CharacterItem{}, err
		}
	}
	result, err := scanCharacter(tx.QueryRow(ctx, query, uuid, userID))
	if err != nil {
		return CharacterItem{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return CharacterItem{}, err
	}
	return result, nil
}
