package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrInteractionConflict = errors.New("Партия уже завершена или между игроками есть незавершённый вызов")
var ErrInvalidInteraction = errors.New("Некорректное сообщение или выбор")

// Only this public projection enters the chronicle. Pending choices stay in SQL.
type InteractionData struct {
	ResolvedByUserID  int64  `json:"resolvedByUserId,omitempty"`
	SenderCharUUID    string `json:"senderCharUuid"`
	RecipientCharUUID string `json:"recipientCharUuid"`
	SenderName        string `json:"senderName"`
	RecipientName     string `json:"recipientName"`
	Message           string `json:"message,omitempty"`
	Status            string `json:"status,omitempty"`
	SenderChoice      string `json:"senderChoice,omitempty"`
	RecipientChoice   string `json:"recipientChoice,omitempty"`
	WinnerCharUUID    string `json:"winnerCharUuid,omitempty"`
}

func ValidRPSChoice(choice string) bool {
	return choice == "rock" || choice == "scissors" || choice == "paper"
}

func ValidInteraction(kind, message, choice string) bool {
	switch kind {
	case "chat_message":
		return strings.TrimSpace(message) != "" && len([]rune(message)) <= 2000 && choice == ""
	case "rps_challenge":
		return message == "" && ValidRPSChoice(choice)
	}
	return false
}

func rpsWinner(sender, recipient string) int {
	if sender == recipient {
		return 0
	}
	if (sender == "rock" && recipient == "scissors") || (sender == "scissors" && recipient == "paper") || (sender == "paper" && recipient == "rock") {
		return 1
	}
	return 2
}

// Character locks share the ordering used by membership transfers and deletion.
func lockInteractionPair(ctx context.Context, tx pgx.Tx, userID, sessionID, senderID, recipientID int64) (map[int64]transferCharacter, error) {
	if senderID == recipientID {
		return nil, ErrNotFound
	}
	chars, err := lockTransferCharacters(ctx, tx, senderID, recipientID)
	if err != nil {
		return nil, err
	}
	if chars[senderID].UserID != userID {
		return nil, ErrNotFound
	}
	var id int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare."session" WHERE id=$1 AND deleted=false FOR SHARE`, sessionID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var count int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_participant p
 JOIN dndshare."char" c ON c.id=p.char_id AND c.user_id=p.user_id
 WHERE p.session_id=$1 AND p.char_id IN ($2,$3)`, sessionID, senderID, recipientID).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count != 2 {
		return nil, ErrNotFound
	}
	return chars, nil
}

func (s *Store) CreateCharacterInteraction(ctx context.Context, userID, sessionID, senderID, recipientID int64, kind, message, choice, clientActionID string) (SessionEvent, error) {
	message = strings.TrimSpace(message)
	if !ValidInteraction(kind, message, choice) {
		return SessionEvent{}, ErrInvalidInteraction
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	chars, err := lockInteractionPair(ctx, tx, userID, sessionID, senderID, recipientID)
	if err != nil {
		return SessionEvent{}, err
	}
	// Serialize retries with the character locks and verify the idempotency key's owner.
	var existingID int64
	err = tx.QueryRow(ctx, `SELECT e.id FROM dndshare.session_event e
 JOIN dndshare.session_interaction i ON i.event_id=e.id
 WHERE e.session_id=$1 AND e.client_action_id=$2::uuid AND e.author_user_id=$3
 AND i.sender_char_id=$4 AND i.recipient_char_id=$5 AND i.kind=$6`, sessionID, clientActionID, userID, senderID, recipientID, kind).Scan(&existingID)
	if err == nil {
		return interactionEventCommit(ctx, tx, existingID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return SessionEvent{}, err
	}
	data := InteractionData{SenderName: characterName(chars[senderID].Data), RecipientName: characterName(chars[recipientID].Data), Message: message}
	if err = tx.QueryRow(ctx, `SELECT sender.uuid::text, recipient.uuid::text FROM dndshare."char" sender, dndshare."char" recipient WHERE sender.id=$1 AND recipient.id=$2`, senderID, recipientID).Scan(&data.SenderCharUUID, &data.RecipientCharUUID); err != nil {
		return SessionEvent{}, err
	}
	action := "Сообщение"
	if kind == "rps_challenge" {
		data.Status = "pending"
		action = "Камень / ножницы / бумага"
	}
	encoded, _ := json.Marshal(data)
	var eventID int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event
 (session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id)
 VALUES($1,$2,$3,$4,$5,$6,CAST($7 AS jsonb),'public',$8::uuid) RETURNING id`, sessionID, userID, senderID, data.SenderName, kind, action, json.RawMessage(encoded), clientActionID).Scan(&eventID)
	if err != nil {
		return SessionEvent{}, interactionSQLError(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_interaction
 (event_id,session_id,sender_char_id,recipient_char_id,kind,sender_choice)
 VALUES($1,$2,$3,$4,$5,NULLIF($6,''))`, eventID, sessionID, senderID, recipientID, kind, choice)
	if err != nil {
		return SessionEvent{}, interactionSQLError(err)
	}
	return interactionEventCommit(ctx, tx, eventID)
}

func interactionSQLError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrInteractionConflict
	}
	return err
}

func interactionEventCommit(ctx context.Context, tx pgx.Tx, id int64) (SessionEvent, error) {
	event, err := scanSessionEvent(tx.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, id))
	if err != nil {
		return SessionEvent{}, err
	}
	return event, tx.Commit(ctx)
}
