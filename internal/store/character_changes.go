package store

import (
	"context"
	"dndshare/internal/documentpatch"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"
)

type documentActorKey struct{}
type documentMutationKey struct{}
type documentMutationInfo struct {
	ID, Hash string
	Metadata json.RawMessage
}

func WithDocumentActor(ctx context.Context, id int64) context.Context {
	return context.WithValue(ctx, documentActorKey{}, id)
}
func WithDocumentMutation(ctx context.Context, id, hash string, metadata json.RawMessage) context.Context {
	return context.WithValue(ctx, documentMutationKey{}, documentMutationInfo{id, hash, metadata})
}

type CharacterChange struct {
	ID            int64                     `json:"id"`
	FromVersion   int64                     `json:"fromVersion"`
	Version       int64                     `json:"version"`
	MutationID    string                    `json:"mutationId"`
	RequestHash   string                    `json:"-"`
	AuthorUserID  *int64                    `json:"authorUserId"`
	TransactionID int64                     `json:"transactionId"`
	Metadata      json.RawMessage           `json:"metadata"`
	Patches       []documentpatch.Operation `json:"patches"`
	Inverse       []documentpatch.Operation `json:"inverse"`
	CreatedAt     time.Time                 `json:"createdAt"`
}

func persistCharacterDocument(ctx context.Context, tx pgx.Tx, charID int64, data json.RawMessage, expected *int64) (int64, error) {
	var previous json.RawMessage
	var version int64
	if err := tx.QueryRow(ctx, `SELECT data,version FROM dndshare."char" WHERE id=$1 AND NOT deleted FOR UPDATE`, charID).Scan(&previous, &version); err != nil {
		return 0, err
	}
	if expected != nil && version != *expected {
		return 0, ErrCharacterVersion
	}
	patches, err := documentpatch.Diff(previous, data)
	if err != nil {
		return 0, err
	}
	inverse, err := documentpatch.Diff(data, previous)
	if err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare."char" SET data=CAST($2 AS jsonb),version=version+1,changed_at=now() WHERE id=$1`, charID, data); err != nil {
		return 0, err
	}
	return version + 1, insertCharacterChange(ctx, tx, charID, version, version+1, rawCharacterJSON(patches), rawCharacterJSON(inverse), nil)
}
func rawCharacterJSON(value any) json.RawMessage { encoded, _ := json.Marshal(value); return encoded }
func insertCharacterChange(ctx context.Context, tx pgx.Tx, charID, from, to int64, forward, backward, explicitMetadata json.RawMessage) error {
	mutation, _ := ctx.Value(documentMutationKey{}).(documentMutationInfo)
	var mutationID any
	if mutation.ID != "" {
		mutationID = mutation.ID
	}
	var actor any
	if id, ok := ctx.Value(documentActorKey{}).(int64); ok {
		actor = id
	}
	metadata := mutation.Metadata
	if len(explicitMetadata) > 0 {
		metadata = explicitMetadata
	}
	if len(metadata) == 0 {
		metadata = json.RawMessage(`[]`)
	}
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.character_change(char_id,from_version,to_version,mutation_id,request_hash,author_user_id,metadata,patches,inverse)
 VALUES($1,$2,$3,COALESCE($4::uuid,gen_random_uuid()),$5,$6,CAST($7 AS jsonb),CAST($8 AS jsonb),CAST($9 AS jsonb))`, charID, from, to, mutationID, mutation.Hash, actor, metadata, forward, backward)
	return err
}

// External character state shares the same version sequence without pretending
// that its command can be replayed as an unrestricted JSON edit.
func bumpCharacterVersion(ctx context.Context, tx pgx.Tx, charID int64, field string, before, after any) error {
	var version int64
	if err := tx.QueryRow(ctx, `UPDATE dndshare."char" SET version=version+1,changed_at=now() WHERE id=$1 RETURNING version`, charID).Scan(&version); err != nil {
		return err
	}
	metadata := rawCharacterJSON([]any{map[string]any{"kind": "metadata", "field": field, "before": before, "after": after}})
	return insertCharacterChange(ctx, tx, charID, version-1, version, json.RawMessage(`[]`), json.RawMessage(`[]`), metadata)
}

const characterChangeColumns = `id,from_version,to_version,mutation_id::text,request_hash,author_user_id,transaction_id,metadata,patches,inverse,created_at`

func scanCharacterChange(row pgx.Row) (CharacterChange, error) {
	var change CharacterChange
	var forward, backward []byte
	err := row.Scan(&change.ID, &change.FromVersion, &change.Version, &change.MutationID, &change.RequestHash, &change.AuthorUserID, &change.TransactionID, &change.Metadata, &forward, &backward, &change.CreatedAt)
	if err != nil {
		return change, err
	}
	if err = json.Unmarshal(forward, &change.Patches); err != nil {
		return change, err
	}
	err = json.Unmarshal(backward, &change.Inverse)
	return change, err
}
func (s *Store) CharacterMutation(ctx context.Context, charID int64, id string) (CharacterChange, error) {
	change, err := scanCharacterChange(s.pool.QueryRow(ctx, `SELECT `+characterChangeColumns+` FROM dndshare.character_change WHERE char_id=$1 AND mutation_id=$2::uuid`, charID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return change, err
}
func (s *Store) CharacterChanges(ctx context.Context, charID, after int64) ([]CharacterChange, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+characterChangeColumns+` FROM dndshare.character_change WHERE char_id=$1 AND to_version>$2 ORDER BY to_version,id LIMIT 200`, charID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []CharacterChange{}
	for rows.Next() {
		change, err := scanCharacterChange(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, change)
	}
	return result, rows.Err()
}
func (s *Store) CharacterHistory(ctx context.Context, charID, before int64) ([]CharacterChange, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+characterChangeColumns+` FROM dndshare.character_change WHERE char_id=$1 AND ($2=0 OR id<$2) AND (patches<>'[]'::jsonb OR metadata<>'[]'::jsonb) ORDER BY id DESC LIMIT 50`, charID, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []CharacterChange{}
	for rows.Next() {
		change, err := scanCharacterChange(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, change)
	}
	return result, rows.Err()
}
