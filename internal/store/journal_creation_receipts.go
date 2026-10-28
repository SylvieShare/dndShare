package store

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
)

var ErrJournalCreationIdentity = errors.New("journal creation identity already used")

type JournalCreationIdentity struct {
	UserID         int64
	ClientActionID string
}

// The journal row is already locked. A receipt commits with the created entity.
func journalCreationReplay(ctx context.Context, tx pgx.Tx, journalID int64, key JournalCreationIdentity, kind string, request any) (int64, string, error) {
	if key.ClientActionID == "" {
		return 0, "", nil
	}
	encoded, err := json.Marshal(request)
	if err != nil {
		return 0, "", err
	}
	fingerprint := fmt.Sprintf("%x", sha256.Sum256(encoded))
	var id, userID int64
	var savedKind, savedHash string
	err = tx.QueryRow(ctx, `SELECT entity_id,user_id,entity_kind,request_hash FROM dndshare.journal_creation_receipt WHERE journal_id=$1 AND client_action_id=$2::uuid`, journalID, key.ClientActionID).Scan(&id, &userID, &savedKind, &savedHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, fingerprint, nil
	}
	if err != nil {
		return 0, "", err
	}
	if userID != key.UserID || kind != savedKind || fingerprint != savedHash {
		return 0, "", ErrJournalCreationIdentity
	}
	return id, fingerprint, nil
}

func saveJournalCreationReceipt(ctx context.Context, tx pgx.Tx, journalID, entityID int64, key JournalCreationIdentity, kind, fingerprint string) error {
	if key.ClientActionID == "" {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.journal_creation_receipt(journal_id,client_action_id,user_id,entity_kind,entity_id,request_hash) VALUES($1,$2::uuid,$3,$4,$5,$6)`, journalID, key.ClientActionID, key.UserID, kind, entityID, fingerprint)
	return err
}
