package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ResolveCharacterInteraction(ctx context.Context, userID, charID, eventID int64, decision string) (SessionEvent, error) {
	if !validRPSDecision(decision) {
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
	if charID != senderID && charID != recipientID {
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
	var round rpsRound
	var encoded json.RawMessage
	err = tx.QueryRow(ctx, `SELECT i.status,COALESCE(i.sender_choice,''),COALESCE(i.recipient_choice,''),e.data
 FROM dndshare.session_interaction i JOIN dndshare.session_event e ON e.id=i.event_id
 WHERE i.event_id=$1 FOR UPDATE OF i`, eventID).Scan(&round.Status, &round.SenderChoice, &round.RecipientChoice, &encoded)
	if err != nil {
		return SessionEvent{}, err
	}
	next, err := advanceRPSRound(round, charID == senderID, decision)
	if err != nil {
		return SessionEvent{}, err
	}
	if next == round {
		return interactionEventCommit(ctx, tx, eventID)
	}
	var data InteractionData
	if err = json.Unmarshal(encoded, &data); err != nil {
		return SessionEvent{}, err
	}
	data.Status = next.Status
	data.ResolvedByUserID = userID
	data.SenderReady, data.RecipientReady = next.SenderChoice != "", next.RecipientChoice != ""
	if next.Status == "completed" {
		data.SenderChoice, data.RecipientChoice = next.SenderChoice, next.RecipientChoice
		switch rpsWinner(next.SenderChoice, next.RecipientChoice) {
		case 1:
			data.WinnerCharUUID = data.SenderCharUUID
		case 2:
			data.WinnerCharUUID = data.RecipientCharUUID
		}
	}
	encoded, _ = json.Marshal(data)
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_interaction SET status=$2,sender_choice=NULLIF($3,''),recipient_choice=NULLIF($4,'') WHERE event_id=$1`, eventID, next.Status, next.SenderChoice, next.RecipientChoice)
	if err != nil {
		return SessionEvent{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=CAST($2 AS jsonb) WHERE id=$1`, eventID, encoded)
	if err != nil {
		return SessionEvent{}, err
	}
	return interactionEventCommit(ctx, tx, eventID)
}
