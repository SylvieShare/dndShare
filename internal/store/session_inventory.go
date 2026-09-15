package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type SessionInventoryEntry struct {
	ID     string          `json:"id"`
	Source string          `json:"source"`
	Name   string          `json:"name"`
	Entry  json.RawMessage `json:"entry"`
}

func inventoryOwner(ctx context.Context, tx pgx.Tx, sessionID, userID int64) error {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM dndshare."session" WHERE id=$1 AND owner_user_id=$2 AND deleted=false FOR SHARE`, sessionID, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) SessionInventory(ctx context.Context, sessionID, userID int64) ([]SessionInventoryEntry, []ItemTransfer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)
	if err = inventoryOwner(ctx, tx, sessionID, userID); err != nil {
		return nil, nil, err
	}
	rows, err := tx.Query(ctx, `SELECT id::text,source,item_name,entry FROM dndshare.session_inventory WHERE session_id=$1 AND available ORDER BY created_at,id`, sessionID)
	if err != nil {
		return nil, nil, err
	}
	entries := []SessionInventoryEntry{}
	for rows.Next() {
		var entry SessionInventoryEntry
		if err = rows.Scan(&entry.ID, &entry.Source, &entry.Name, &entry.Entry); err != nil {
			rows.Close()
			return nil, nil, err
		}
		entries = append(entries, entry)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, nil, err
	}
	rows, err = tx.Query(ctx, itemTransferSelect+` WHERE t.session_id=$1 AND t.status='pending' AND t.purpose='transfer' AND (t.sender_char_id IS NULL OR t.recipient_char_id IS NULL) ORDER BY t.id`, sessionID)
	if err != nil {
		return nil, nil, err
	}
	offers := []ItemTransfer{}
	for rows.Next() {
		offer, e := scanItemTransfer(rows)
		if e != nil {
			rows.Close()
			return nil, nil, e
		}
		offers = append(offers, offer)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, nil, err
	}
	return entries, offers, tx.Commit(ctx)
}

func receiveSessionInventory(ctx context.Context, tx pgx.Tx, sessionID int64, source, name string, entry map[string]any) error {
	raw, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_inventory(session_id,source,item_name,entry) VALUES($1,$2,$3,CAST($4 AS jsonb))`, sessionID, source, name, json.RawMessage(raw))
	return err
}

func inventoryEvent(ctx context.Context, tx pgx.Tx, sessionID, userID int64, eventType, action, name string, entry map[string]any) error {
	itemID := entry["magic_item_id"]
	if itemID == nil {
		itemID = entry["item_id"]
	}
	data, _ := json.Marshal(map[string]any{"source": map[string]any{"name": name, "itemId": itemID}, "count": entry["count"]})
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility) VALUES($1,$2,$3,$4,CAST($5 AS jsonb),'gm')`, sessionID, userID, eventType, action+": "+name, json.RawMessage(data))
	return err
}

// AddSessionInventory keeps a durable action id even after removal or reservation.
func (s *Store) AddSessionInventory(ctx context.Context, sessionID, userID int64, source, name, actionID string, raw json.RawMessage) error {
	if source != "items" && source != "weapon" && source != "potions" {
		return ErrApplication
	}
	var entry map[string]any
	if json.Unmarshal(raw, &entry) != nil || entry == nil {
		return ErrApplication
	}
	count := number(entry["count"])
	if count < 1 || count > 999 || (source == "weapon" && count != 1) {
		return ErrApplication
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = inventoryOwner(ctx, tx, sessionID, userID); err != nil {
		return err
	}
	itemID := number(entry["magic_item_id"])
	if itemID == 0 {
		itemID = number(entry["item_id"])
	}
	if itemID > 0 {
		var kind int
		name, _, kind, err = visibleApplicationItem(ctx, tx, int64(itemID), userID)
		if err != nil {
			return err
		}
		if (source == "potions" && kind != 10) || (source == "weapon" && kind != 1 && kind != 19) || (source == "items" && kind != 2 && kind != 19) {
			return ErrApplication
		}
	} else {
		name = strings.TrimSpace(name)
		if name == "" || len([]rune(name)) > 160 {
			return ErrApplication
		}
		override, _ := entry["override"].(map[string]any)
		if override == nil {
			override = map[string]any{}
		}
		override["name"] = name
		entry["override"] = override
	}
	entry["count"] = count
	entry["uid"] = actionID
	raw, err = json.Marshal(entry)
	if err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `INSERT INTO dndshare.session_inventory(session_id,source,item_name,entry,client_action_id) VALUES($1,$2,$3,CAST($4 AS jsonb),$5::uuid) ON CONFLICT(session_id,client_action_id) DO NOTHING`, sessionID, source, name, raw, actionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		if err = inventoryEvent(ctx, tx, sessionID, userID, "entry_added", "В инвентарь сессии", name, entry); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteSessionInventory(ctx context.Context, sessionID, userID int64, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = inventoryOwner(ctx, tx, sessionID, userID); err != nil {
		return err
	}
	var name string
	var raw json.RawMessage
	err = tx.QueryRow(ctx, `UPDATE dndshare.session_inventory SET available=false WHERE session_id=$1 AND id=$2::uuid AND available RETURNING item_name,entry`, sessionID, id).Scan(&name, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return tx.Commit(ctx)
	}
	if err != nil {
		return err
	}
	var entry map[string]any
	_ = json.Unmarshal(raw, &entry)
	if err = inventoryEvent(ctx, tx, sessionID, userID, "item_spent", "Удалено из инвентаря сессии", name, entry); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
