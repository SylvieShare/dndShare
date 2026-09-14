package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type ItemTransfer struct {
	Purpose            string          `json:"purpose"`
	AuthorUserID       int64           `json:"authorUserId"`
	RecipientUserID    int64           `json:"recipientUserId"`
	SessionOwnerUserID int64           `json:"sessionOwnerUserId"`
	SenderImageURL     *string         `json:"senderImageUrl,omitempty"`
	ID                 int64           `json:"id"`
	SessionID          int64           `json:"-"`
	EventID            int64           `json:"eventId"`
	SenderCharID       int64           `json:"-"`
	RecipientCharID    int64           `json:"-"`
	SenderCharUUID     string          `json:"senderCharUuid"`
	RecipientCharUUID  string          `json:"recipientCharUuid"`
	SenderName         string          `json:"senderName"`
	RecipientName      string          `json:"recipientName"`
	ItemName           string          `json:"itemName"`
	Source             string          `json:"source"`
	Entry              json.RawMessage `json:"entry"`
	Status             string          `json:"status"`
	CreatedAt          time.Time       `json:"createdAt"`
	ResolvedAt         *time.Time      `json:"resolvedAt,omitempty"`
}

const itemTransferSelect = `SELECT t.id, t.session_id, t.event_id, t.sender_char_id, t.recipient_char_id,
 sender.uuid::text, recipient.uuid::text, t.sender_name, t.recipient_name,
 t.item_name, t.source, t.entry, t.status, t.created_at, t.resolved_at, COALESCE(sender_icon.url, sender.data #>> '{values,ava,url}'), transfer_event.author_user_id, recipient.user_id, transfer_session.owner_user_id, t.purpose
 FROM dndshare.item_transfer t JOIN dndshare."char" sender ON sender.id=t.sender_char_id
 JOIN dndshare."char" recipient ON recipient.id=t.recipient_char_id
 JOIN dndshare.session_event transfer_event ON transfer_event.id=t.event_id
 JOIN dndshare."session" transfer_session ON transfer_session.id=t.session_id
 LEFT JOIN dndshare.storage_image sender_icon ON sender_icon.id=sender.icon_image_id AND sender_icon.deleted=false`

func scanItemTransfer(row pgx.Row) (ItemTransfer, error) {
	var t ItemTransfer
	err := row.Scan(&t.ID, &t.SessionID, &t.EventID, &t.SenderCharID, &t.RecipientCharID,
		&t.SenderCharUUID, &t.RecipientCharUUID, &t.SenderName, &t.RecipientName, &t.ItemName,
		&t.Source, &t.Entry, &t.Status, &t.CreatedAt, &t.ResolvedAt, &t.SenderImageURL, &t.AuthorUserID, &t.RecipientUserID, &t.SessionOwnerUserID, &t.Purpose)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return t, err
}

func (s *Store) PendingItemTransfers(ctx context.Context, charID int64) ([]ItemTransfer, error) {
	rows, err := s.pool.Query(ctx, itemTransferSelect+` WHERE t.status='pending'
 AND (t.sender_char_id=$1 OR t.recipient_char_id=$1) ORDER BY t.id`, charID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ItemTransfer{}
	for rows.Next() {
		t, err := scanItemTransfer(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

type transferCharacter struct {
	ID      int64
	UserID  int64
	Version int64
	Data    json.RawMessage
}

func lockTransferCharacters(ctx context.Context, tx pgx.Tx, senderID, recipientID int64) (map[int64]transferCharacter, error) {
	rows, err := tx.Query(ctx, `SELECT id,user_id,version,data FROM dndshare."char"
 WHERE id IN ($1,$2) AND deleted=false ORDER BY id FOR UPDATE`, senderID, recipientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64]transferCharacter{}
	for rows.Next() {
		var c transferCharacter
		if err := rows.Scan(&c.ID, &c.UserID, &c.Version, &c.Data); err != nil {
			return nil, err
		}
		result[c.ID] = c
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(result) != 2 {
		return nil, ErrNotFound
	}
	return result, nil
}

func saveTransferDocument(ctx context.Context, tx pgx.Tx, charID int64, doc transferDocument) error {
	raw, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare."char" SET data=CAST($2 AS jsonb), version=version+1, changed_at=now() WHERE id=$1`, charID, json.RawMessage(raw))
	return err
}

// CreateItemTransfer reserves a whole owned entry (including its stack count).
func (s *Store) CreateItemTransfer(ctx context.Context, userID, sessionID, senderID, recipientID, version int64, source, uid, actionID string) (ItemTransfer, error) {
	return s.createItemTransfer(ctx, userID, sessionID, senderID, recipientID, version, source, uid, actionID, "transfer")
}

// CreatePotionUse reserves one dose until the recipient accepts or rejects its use.
func (s *Store) CreatePotionUse(ctx context.Context, userID, sessionID, senderID, recipientID, version int64, uid, actionID string) (ItemTransfer, error) {
	return s.createItemTransfer(ctx, userID, sessionID, senderID, recipientID, version, "potions", uid, actionID, "use")
}

func (s *Store) createItemTransfer(ctx context.Context, userID, sessionID, senderID, recipientID, version int64, source, uid, actionID, purpose string) (ItemTransfer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ItemTransfer{}, err
	}
	defer tx.Rollback(ctx)
	var session int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare."session" WHERE id=$1 AND deleted=false FOR SHARE`, sessionID).Scan(&session)
	if errors.Is(err, pgx.ErrNoRows) {
		return ItemTransfer{}, ErrNotFound
	}
	if err != nil {
		return ItemTransfer{}, err
	}
	chars, err := lockTransferCharacters(ctx, tx, senderID, recipientID)
	if err != nil {
		return ItemTransfer{}, err
	}
	sender, recipient := chars[senderID], chars[recipientID]
	if sender.UserID != userID {
		return ItemTransfer{}, ErrNotFound
	}
	// Retries after a lost HTTP response return the original reservation.
	existing, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.sender_char_id=$1 AND t.client_action_id=$2::uuid`, senderID, actionID))
	if err == nil {
		var reserved map[string]any
		if json.Unmarshal(existing.Entry, &reserved) != nil || existing.Purpose != purpose || existing.SessionID != sessionID || existing.RecipientCharID != recipientID || existing.Source != source || reserved["uid"] != uid {
			return ItemTransfer{}, ErrItemTransferConflict
		}
		return existing, tx.Commit(ctx)
	}
	if !errors.Is(err, ErrNotFound) {
		return ItemTransfer{}, err
	}
	if sender.Version != version {
		return ItemTransfer{}, ErrCharacterVersion
	}
	rows, err := tx.Query(ctx, `SELECT char_id FROM dndshare.session_participant WHERE session_id=$1 AND char_id IN ($2,$3) ORDER BY char_id FOR SHARE`, sessionID, senderID, recipientID)
	if err != nil {
		return ItemTransfer{}, err
	}
	count := 0
	for rows.Next() {
		count++
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return ItemTransfer{}, err
	}
	if count != 2 {
		return ItemTransfer{}, ErrNotFound
	}
	doc, err := decodeTransferDocument(sender.Data)
	if err != nil {
		return ItemTransfer{}, err
	}
	var entry map[string]any
	if purpose == "use" {
		entry, err = doc.takePotionDose(uid)
	} else {
		entry, err = doc.take(source, uid)
	}
	if err != nil {
		return ItemTransfer{}, err
	}
	name := "Предмет"
	if override, ok := entry["override"].(map[string]any); ok {
		if n, ok := override["name"].(string); ok && n != "" {
			name = n
		}
	}
	itemID := entry["magic_item_id"]
	if itemID == nil {
		itemID = entry["item_id"]
	}
	if name == "Предмет" && itemID != nil {
		err = tx.QueryRow(ctx, `SELECT name FROM dndshare.item WHERE id=$1`, itemID).Scan(&name)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return ItemTransfer{}, err
		}
	}
	name = truncateRunes(name, 160)
	raw, _ := json.Marshal(entry)
	eventData, _ := json.Marshal(map[string]any{"purpose": purpose, "status": "pending", "senderName": characterName(sender.Data), "recipientName": characterName(recipient.Data), "source": map[string]any{"itemId": itemID, "name": name}, "count": entry["count"]})
	action := "Передача: " + name
	if purpose == "use" {
		action = "Применение: " + name
	}
	var eventID int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility)
 VALUES($1,$2,$3,$4,'item_transfer',$5,CAST($6 AS jsonb),'public') RETURNING id`, sessionID, userID, senderID, characterName(sender.Data), action, json.RawMessage(eventData)).Scan(&eventID)
	if err != nil {
		return ItemTransfer{}, err
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.item_transfer(session_id,sender_char_id,recipient_char_id,client_action_id,event_id,source,entry,item_name,sender_name,recipient_name,purpose)
 VALUES($1,$2,$3,$4::uuid,$5,$6,CAST($7 AS jsonb),$8,$9,$10,$11) RETURNING id`, sessionID, senderID, recipientID, actionID, eventID, source, json.RawMessage(raw), name, characterName(sender.Data), characterName(recipient.Data), purpose).Scan(&id)
	if err != nil {
		return ItemTransfer{}, err
	}
	if err = saveTransferDocument(ctx, tx, senderID, doc); err != nil {
		return ItemTransfer{}, err
	}
	transfer, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.id=$1`, id))
	if err != nil {
		return ItemTransfer{}, err
	}
	return transfer, tx.Commit(ctx)
}

func (s *Store) ResolveItemTransfer(ctx context.Context, userID, charID, transferID int64, accept bool) (ItemTransfer, error) {
	return s.resolveItemTransfer(ctx, userID, charID, transferID, 0, accept)
}

// ApproveSessionTransfer lets the session owner accept an offer by its chronicle event.
func (s *Store) ApproveSessionTransfer(ctx context.Context, userID, sessionID, eventID int64) (ItemTransfer, error) {
	return s.resolveItemTransfer(ctx, userID, 0, eventID, sessionID, true)
}

func (s *Store) resolveItemTransfer(ctx context.Context, userID, charID, id, sessionID int64, accept bool) (ItemTransfer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ItemTransfer{}, err
	}
	defer tx.Rollback(ctx)
	where := ` WHERE t.id=$1`
	if sessionID != 0 {
		where = ` WHERE t.event_id=$1`
	}
	t, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+where, id))
	if err != nil {
		return t, err
	}
	chars, err := lockTransferCharacters(ctx, tx, t.SenderCharID, t.RecipientCharID)
	if err != nil {
		return t, err
	}
	// Match creation's character -> request lock order, including concurrent retries.
	t, err = scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+where+` FOR UPDATE OF t`, id))
	if err != nil {
		return t, err
	}
	// Session approval is separate from the recipient/sender character operation.
	if sessionID != 0 {
		if t.SessionID != sessionID || t.SessionOwnerUserID != userID {
			return t, ErrNotFound
		}
	} else {
		if charID != t.RecipientCharID && (accept || charID != t.SenderCharID) {
			return t, ErrNotFound
		}
		if chars[charID].UserID != userID {
			return t, ErrNotFound
		}
	}
	status := "rejected"
	destination := t.SenderCharID
	if accept {
		status = "accepted"
		destination = t.RecipientCharID
	}
	if t.Status == status {
		return t, tx.Commit(ctx)
	}
	if t.Status != "pending" {
		return t, ErrItemTransferConflict
	}
	doc, err := decodeTransferDocument(chars[destination].Data)
	if err != nil {
		return t, err
	}
	var entry map[string]any
	if err = json.Unmarshal(t.Entry, &entry); err != nil {
		return t, err
	}
	if t.Purpose == "use" {
		if !accept {
			doc.returnPotionDose(entry, fmt.Sprintf("returned-use-%d", t.ID))
		}
	} else {
		doc.receive(t.Source, entry, accept, fmt.Sprintf("transfer-%d", t.ID))
	}
	if t.Purpose != "use" || !accept {
		if err = saveTransferDocument(ctx, tx, destination, doc); err != nil {
			return t, err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.item_transfer SET status=$2,resolved_at=now() WHERE id=$1`, t.ID, status)
	if err != nil {
		return t, err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=jsonb_set(data,'{status}',to_jsonb($2::text)) WHERE id=$1`, t.EventID, status)
	if err != nil {
		return t, err
	}
	t, err = scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.id=$1`, t.ID))
	if err != nil {
		return t, err
	}
	return t, tx.Commit(ctx)
}
