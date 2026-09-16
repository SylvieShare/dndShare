package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
)

type npcApplicationDocument struct {
	historyHandled       bool
	historyAction        string
	historyEventID       int64
	id                   int64
	encounter, combatant map[string]any
	document             transferDocument
	target               ApplicationTarget
}

func npcApplicationTarget(id int64, c map[string]any, name string) ApplicationTarget {
	if own := textValue(object(c["override"])["name"]); own != "" {
		name = own
	}
	color := textValue(c["iconColor"])
	if color == "" {
		color = map[string]string{"enemy": "var(--side-enemy)", "ally": "var(--success)", "neutral": "var(--side-neutral)", "minion": "var(--side-minion)"}[textValue(c["side"])]
	}
	return ApplicationTarget{Kind: "npc", NPCUID: textValue(c["uid"]), EncounterID: id, Name: name, Letter: textValue(c["markerLetter"]), Color: color}
}
func loadNPCApplication(ctx context.Context, tx pgx.Tx, sessionID int64, target ApplicationTarget) (*npcApplicationDocument, error) {
	var raw json.RawMessage
	var id int64
	err := tx.QueryRow(ctx, `SELECT id,data FROM dndshare.session_encounter WHERE session_id=$1 AND deleted=false ORDER BY id DESC LIMIT 1 FOR UPDATE`, sessionID).Scan(&id, &raw)
	if err != nil || id != target.EncounterID {
		return nil, ErrNotFound
	}
	var enc map[string]any
	if err = json.Unmarshal(raw, &enc); err != nil {
		return nil, err
	}
	for _, v := range array(enc["combatants"]) {
		c := object(v)
		if c["type"] != "npc" || c["uid"] != target.NPCUID {
			continue
		}
		name := "Существо"
		data := map[string]any{}
		if itemID := number(c["itemId"]); itemID > 0 {
			var kind int
			name, data, kind, err = applicationItem(ctx, tx, int64(itemID))
			if err != nil {
				return nil, err
			}
			if kind != 6 {
				return nil, ErrApplication
			}
		}
		hp := number(object(data["combat"])["hp"])
		if value, ok := object(c["override"])["hp"]; ok {
			hp = number(value)
		}
		if c["hpCurrent"] == nil {
			c["hpCurrent"] = hp
		}
		doc := transferDocument{"values": map[string]any{"hp": map[string]any{"current": c["hpCurrent"], "temp": c["hpTemp"], "max": hp, "ds_success": c["hpDsSuccess"], "ds_failure": c["hpDsFailure"]}, "states": c["effectInstances"]}}
		return &npcApplicationDocument{id: id, encounter: enc, combatant: c, document: doc, target: npcApplicationTarget(id, c, name)}, nil
	}
	return nil, ErrNotFound
}
func (n *npcApplicationDocument) save(ctx context.Context, tx pgx.Tx, doc transferDocument) error {
	before := map[string]any{}
	for k, v := range n.combatant {
		before[k] = v
	}
	hp := object(doc.values()["hp"])
	n.combatant["hpCurrent"] = hp["current"]
	n.combatant["hpTemp"] = hp["temp"]
	n.combatant["hpDsSuccess"] = hp["ds_success"]
	n.combatant["hpDsFailure"] = hp["ds_failure"]
	n.combatant["effectInstances"] = doc.values()["states"]
	if !n.historyHandled {
		action := n.historyAction
		if action == "" {
			action = "Изменение эффекта"
		}
		record, err := npcImpactDifference(ctx, tx, before, n.combatant, n.target, action, n.historyEventID)
		if err != nil {
			return err
		}
		if record != nil {
			appendNPCHistory(n.combatant, record)
		}
	}
	n.encounter["applicationRevision"] = number(n.encounter["applicationRevision"]) + 1
	raw, err := json.Marshal(n.encounter)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_encounter SET data=CAST($2 AS jsonb),changed_at=now() WHERE id=$1`, n.id, json.RawMessage(raw))
	return err
}
