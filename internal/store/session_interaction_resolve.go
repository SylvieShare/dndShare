package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ResolveCharacterInteraction(ctx context.Context, userID, charID, eventID int64, decision string) (SessionEvent, error) {
	if decision != "decline" && decision != "cancel" && !ValidRPSChoice(decision) {
		return SessionEvent{}, ErrInvalidInteraction
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	var senderID, recipientID, sessionID int64
	err = tx.QueryRow(ctx, `SELECT sender_char_id,recipient_char_id,session_id FROM dndshare.session_interaction WHERE event_id=$1 AND kind='rps_challenge'`, eventID).Scan(&senderID, &recipientID, &sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionEvent{}, ErrNotFound
	}
	if err != nil {
		return SessionEvent{}, err
	}
	if (decision == "cancel" && charID != senderID) || (decision != "cancel" && charID != recipientID) {
		return SessionEvent{}, ErrNotFound
	}
	// Lock the pair in the same order as creation. Only the acting character needs
	// current membership: a player may dismiss a challenge after the peer leaves.
	var locked int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM (
 SELECT id FROM dndshare."char" WHERE id IN ($1,$2) ORDER BY id FOR UPDATE
 ) pair`, senderID, recipientID).Scan(&locked)
	if err != nil {
		return SessionEvent{}, err
	}
	if locked != 2 {
		return SessionEvent{}, ErrNotFound
	}
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.session_participant p
 JOIN dndshare."session" s ON s.id=p.session_id
 JOIN dndshare."char" own ON own.id=p.char_id AND own.user_id=$3 AND own.deleted=false
 WHERE p.session_id=$1 AND p.char_id=$2 AND p.user_id=$3 AND s.deleted=false)`, sessionID, charID, userID).Scan(&allowed)
	if err != nil {
		return SessionEvent{}, err
	}
	if !allowed {
		return SessionEvent{}, ErrNotFound
	}
	var status, senderChoice string
	var recipientChoice *string
	var encoded json.RawMessage
	err = tx.QueryRow(ctx, `SELECT i.status,i.sender_choice,i.recipient_choice,e.data
 FROM dndshare.session_interaction i JOIN dndshare.session_event e ON e.id=i.event_id
 WHERE i.event_id=$1 FOR UPDATE OF i`, eventID).Scan(&status, &senderChoice, &recipientChoice, &encoded)
	if err != nil {
		return SessionEvent{}, err
	}
	wanted := "completed"
	if decision == "decline" {
		wanted = "declined"
	}
	if decision == "cancel" {
		wanted = "cancelled"
	}
	if status != "pending" {
		if status == wanted && (wanted != "completed" || (recipientChoice != nil && *recipientChoice == decision)) {
			return interactionEventCommit(ctx, tx, eventID)
		}
		return SessionEvent{}, ErrInteractionConflict
	}
	var data InteractionData
	if err = json.Unmarshal(encoded, &data); err != nil {
		return SessionEvent{}, err
	}
	data.Status = wanted
	data.ResolvedByUserID = userID
	if wanted == "completed" {
		data.SenderChoice, data.RecipientChoice = senderChoice, decision
		recipientChoice = &decision
		switch rpsWinner(senderChoice, decision) {
		case 1:
			data.WinnerCharUUID = data.SenderCharUUID
		case 2:
			data.WinnerCharUUID = data.RecipientCharUUID
		}
	}
	encoded, _ = json.Marshal(data)
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_interaction SET status=$2,recipient_choice=$3 WHERE event_id=$1`, eventID, wanted, recipientChoice)
	if err != nil {
		return SessionEvent{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=CAST($2 AS jsonb) WHERE id=$1`, eventID, encoded)
	if err != nil {
		return SessionEvent{}, err
	}
	return interactionEventCommit(ctx, tx, eventID)
}
