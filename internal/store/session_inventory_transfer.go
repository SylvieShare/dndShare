package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) SendSessionInventory(ctx context.Context, sessionID, userID, recipientID int64, entryID, actionID string) (ItemTransfer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ItemTransfer{}, err
	}
	defer tx.Rollback(ctx)
	if err = inventoryOwner(ctx, tx, sessionID, userID); err != nil {
		return ItemTransfer{}, err
	}
	chars, err := lockTransferCharacters(ctx, tx, 0, recipientID)
	if err != nil {
		return ItemTransfer{}, err
	}
	var member int64
	if err = tx.QueryRow(ctx, `SELECT char_id FROM dndshare.session_participant WHERE session_id=$1 AND char_id=$2 FOR SHARE`, sessionID, recipientID).Scan(&member); err != nil {
		return ItemTransfer{}, ErrNotFound
	}
	old, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.session_id=$1 AND t.sender_char_id IS NULL AND t.client_action_id=$2::uuid`, sessionID, actionID))
	if err == nil {
		var entry map[string]any
		_ = json.Unmarshal(old.Entry, &entry)
		if old.RecipientCharID != recipientID || entry["uid"] != entryID {
			return old, ErrItemTransferConflict
		}
		return old, tx.Commit(ctx)
	}
	if !errors.Is(err, ErrNotFound) {
		return ItemTransfer{}, err
	}
	var source, name string
	var raw json.RawMessage
	err = tx.QueryRow(ctx, `UPDATE dndshare.session_inventory SET available=false WHERE session_id=$1 AND id=$2::uuid AND available RETURNING source,item_name,entry`, sessionID, entryID).Scan(&source, &name, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return ItemTransfer{}, ErrItemTransferConflict
	}
	if err != nil {
		return ItemTransfer{}, err
	}
	var entry map[string]any
	_ = json.Unmarshal(raw, &entry)
	entry["uid"] = entryID
	raw, _ = json.Marshal(entry)
	recipientName := characterName(chars[recipientID].Data)
	itemID := entry["magic_item_id"]
	if itemID == nil {
		itemID = entry["item_id"]
	}
	data, _ := json.Marshal(map[string]any{"purpose": "transfer", "status": "pending", "senderName": "Мастер", "recipientName": recipientName, "source": map[string]any{"itemId": itemID, "name": name}, "count": entry["count"], "fromSessionInventory": true})
	var eventID, id int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_name,event_type,action,data,visibility) VALUES($1,$2,NULL,'item_transfer',$3,CAST($4 AS jsonb),'public') RETURNING id`, sessionID, userID, "Передача: "+name, json.RawMessage(data)).Scan(&eventID)
	if err != nil {
		return ItemTransfer{}, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.item_transfer(session_id,sender_char_id,recipient_char_id,client_action_id,event_id,source,entry,item_name,sender_name,recipient_name) VALUES($1,NULL,$2,$3::uuid,$4,$5,CAST($6 AS jsonb),$7,'Мастер',$8) RETURNING id`, sessionID, recipientID, actionID, eventID, source, raw, name, recipientName).Scan(&id)
	if err != nil {
		return ItemTransfer{}, err
	}
	offer, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.id=$1`, id))
	if err != nil {
		return offer, err
	}
	return offer, tx.Commit(ctx)
}
