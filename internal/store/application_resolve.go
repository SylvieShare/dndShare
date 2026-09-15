package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func (s *Store) resolveItemTransfer(ctx context.Context, userID, charID, id, sessionID int64, accept bool, target ApplicationTarget) (ItemTransfer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ItemTransfer{}, err
	}
	defer tx.Rollback(ctx)
	if err = lockConcentrationGraph(ctx, tx); err != nil {
		return ItemTransfer{}, err
	}
	result, err := s.resolveItemTransferTx(ctx, tx, userID, charID, id, sessionID, accept, target)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func (s *Store) resolveItemTransferTx(ctx context.Context, tx pgx.Tx, userID, charID, id, sessionID int64, accept bool, target ApplicationTarget) (ItemTransfer, error) {
	var err error
	where := ` WHERE t.id=$1`
	if sessionID != 0 {
		where = ` WHERE t.event_id=$1`
	}
	t, err := scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+where, id))
	if err != nil {
		return t, err
	}
	destinationID := t.RecipientCharID
	if t.AddressedToDM && t.Purpose == "use" && accept && t.Status == "pending" {
		if sessionID == 0 || t.SessionID != sessionID || t.SessionOwnerUserID != userID {
			return t, ErrNotFound
		}
		if target.Kind == "character" {
			err = tx.QueryRow(ctx, `SELECT c.id FROM dndshare."char" c JOIN dndshare.session_participant p ON p.char_id=c.id WHERE p.session_id=$1 AND c.uuid=$2::uuid AND c.deleted=false FOR SHARE OF p`, sessionID, target.CharUUID).Scan(&destinationID)
			if err != nil {
				return t, ErrNotFound
			}
		} else if target.Kind != "npc" || target.NPCUID == "" || target.EncounterID <= 0 {
			return t, ErrApplication
		}
	}
	chars, err := lockTransferCharacters(ctx, tx, t.SenderCharID, destinationID)
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
		destination = destinationID
	}
	if t.Status == status {
		return t, nil
	}
	if t.Status != "pending" {
		return t, ErrItemTransferConflict
	}
	resolved := ApplicationTarget{}
	if accept && t.AddressedToDM && t.Purpose == "use" {
		resolved = target
		resolved.CharID = destinationID
	}
	var doc transferDocument
	var npc *npcApplicationDocument
	if accept && t.AddressedToDM && t.Purpose == "use" && target.Kind == "npc" {
		npc, err = loadNPCApplication(ctx, tx, t.SessionID, target)
		if err != nil {
			return t, err
		}
		doc = npc.document
		resolved = npc.target
	} else if destination == 0 && t.Purpose == "transfer" {
		doc = transferDocument{"values": map[string]any{}}
	} else {
		doc, err = decodeTransferDocument(chars[destination].Data)
	}
	if err != nil {
		return t, err
	}
	var entry map[string]any
	if err = json.Unmarshal(t.Entry, &entry); err != nil {
		return t, err
	}
	result := ApplicationResult{}
	var appliedPlan ApplicationPlan
	if t.Purpose == "use" {
		if accept {
			var plan ApplicationPlan
			if err = json.Unmarshal(t.Application, &plan); err != nil {
				return t, err
			}
			if plan.Name == "" {
				plan, err = buildPotionApplication(ctx, tx, entry, "", chars[t.SenderCharID].UserID)
				if err != nil {
					return t, err
				}
			}
			if t.Source == "spells" {
				if npc != nil || destination != t.SenderCharID {
					plan.CasterUUID = t.SenderCharUUID
				}
				if plan.ConcentrationID != "" {
					var current string
					if e := tx.QueryRow(ctx, `SELECT cast_id::text FROM dndshare.character_concentration WHERE char_id=$1`, t.SenderCharID).Scan(&current); e != nil || current != plan.ConcentrationID {
						return t, ErrConcentrationExpired
					}
				}
			}
			if err = validateSpellCastTarget(ctx, tx, plan, t, resolved, destination); err != nil {
				return t, err
			}
			appliedPlan = plan
			if err = prepareSpellHealing(ctx, tx, &plan); err != nil {
				return t, err
			}
			if npc != nil {
				result, err = applyApplication(doc, plan, fmt.Sprintf("transfer-%d", t.ID), secureApplicationDie)
			} else {
				result, err = applyApplicationTx(ctx, tx, doc, plan, fmt.Sprintf("transfer-%d", t.ID))
			}
			if err != nil {
				return t, err
			}
		} else if t.Source != "spells" {
			doc.returnPotionDose(entry, fmt.Sprintf("returned-use-%d", t.ID))
		}
	} else {
		doc.receive(t.Source, entry, accept, fmt.Sprintf("transfer-%d", t.ID))
	}
	if npc != nil {
		err = npc.save(ctx, tx, doc)
	} else if destination == 0 && t.Purpose == "transfer" {
		err = receiveSessionInventory(ctx, tx, t.SessionID, t.Source, t.ItemName, entry)
	} else if accept || t.Source != "spells" {
		err = saveTransferDocument(ctx, tx, destination, doc)
	}
	if err != nil {
		return t, err
	}
	if accept && t.AddressedToDM && t.Purpose == "use" && target.Kind == "character" {
		resolved.Name = characterName(chars[destination].Data)
	}
	if accept && appliedPlan.ConcentrationID != "" {
		linkedTarget := resolved
		if linkedTarget.Kind == "" {
			linkedTarget = ApplicationTarget{Kind: "character", CharID: destination, CharUUID: t.RecipientCharUUID, Name: t.RecipientName}
		}
		if err = linkConcentrationEffects(ctx, tx, doc, appliedPlan, linkedTarget); err != nil {
			return t, err
		}
	}
	rawTarget, _ := json.Marshal(resolved)
	rawResult, _ := json.Marshal(result)
	_, err = tx.Exec(ctx, `UPDATE dndshare.item_transfer SET status=$2,resolved_at=now(),application_result=CAST($3 AS jsonb),resolved_target=CAST($4 AS jsonb) WHERE id=$1`, t.ID, status, json.RawMessage(rawResult), json.RawMessage(rawTarget))
	if err != nil {
		return t, err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=jsonb_set(data,'{status}',to_jsonb($2::text)) || jsonb_build_object('applicationResult',CAST($3 AS jsonb),'resolvedTarget',CAST($4 AS jsonb)) WHERE id=$1`, t.EventID, status, json.RawMessage(rawResult), json.RawMessage(rawTarget))
	if err != nil {
		return t, err
	}
	t, err = scanItemTransfer(tx.QueryRow(ctx, itemTransferSelect+` WHERE t.id=$1`, t.ID))
	if err != nil {
		return t, err
	}
	return t, nil
}
