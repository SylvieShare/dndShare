package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"time"
)

func appendNPCHistory(c, record map[string]any) {
	c["impactHistory"] = append(array(c["impactHistory"]), record)
}
func npcHP(c map[string]any) ImpactHP {
	return ImpactHP{number(c["hpCurrent"]), number(c["hpTemp"]), number(object(c["override"])["hp"])}
}
func npcEffectInstances(c map[string]any) map[string]map[string]any {
	instances := map[string]map[string]any{}
	for _, v := range array(c["effectInstances"]) {
		state := object(v)
		if number(state["effect_id"]) > 0 {
			instances[textValue(state["uid"])] = state
		}
	}
	for _, v := range array(c["states"]) {
		id := number(v)
		if id == 0 {
			id = number(object(v)["id"])
		}
		if id > 0 {
			instances[fmt.Sprintf("manual:%d", id)] = map[string]any{"effect_id": id}
		}
	}
	return instances
}
func npcImpactDifference(ctx context.Context, tx pgx.Tx, before, after map[string]any, target ApplicationTarget, action string, eventID int64) (map[string]any, error) {
	b, a := npcHP(before), npcHP(after)
	if id := number(after["itemId"]); id > 0 {
		_, data, _, err := applicationItem(ctx, tx, int64(id))
		if err != nil {
			return nil, err
		}
		maximum := number(object(data["combat"])["hp"])
		if object(before["override"])["hp"] == nil {
			b.Max = maximum
		}
		if object(after["override"])["hp"] == nil {
			a.Max = maximum
		}
		if before["hpCurrent"] == nil {
			b.Current = b.Max
		}
		if after["hpCurrent"] == nil {
			a.Current = a.Max
		}
	}
	added := []ApplicationEffect{}
	removed := []int{}
	oldInstances, newInstances := npcEffectInstances(before), npcEffectInstances(after)
	newIDs := map[int]bool{}
	for key, state := range newInstances {
		id := number(state["effect_id"])
		newIDs[id] = true
		if oldInstances[key] == nil {
			name, _, _, err := applicationItem(ctx, tx, int64(id))
			if err != nil {
				return nil, err
			}
			added = append(added, ApplicationEffect{ID: int64(id), Name: name, Duration: object(state["duration"])})
		}
	}
	removedIDs := map[int]bool{}
	for _, state := range oldInstances {
		id := number(state["effect_id"])
		if !newIDs[id] && !removedIDs[id] {
			removed = append(removed, id)
			removedIDs[id] = true
		}
	}
	if b.Current == a.Current && b.Temp == a.Temp && len(added) == 0 && len(removed) == 0 {
		return nil, nil
	}
	result := ImpactResult{Key: saveTargetKey(target), Target: target, Before: b, After: a, HPLost: max(0, b.Current-a.Current), Absorbed: max(0, b.Temp-a.Temp), Effects: added, EffectsRemoved: removed, Action: action, EventID: eventID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	result.Total = b.Current - a.Current + b.Temp - a.Temp
	raw, _ := json.Marshal(result)
	var record map[string]any
	_ = json.Unmarshal(raw, &record)
	return record, nil
}

// History is server-owned: stale saves and cloned NPCs cannot overwrite it.
// Each actual change and its chronicle event commit with the encounter document.
func recordEncounterChanges(ctx context.Context, tx pgx.Tx, sessionID, encounterID int64, oldDoc, newDoc map[string]any) error {
	old := map[string]map[string]any{}
	for _, v := range array(oldDoc["combatants"]) {
		c := object(v)
		old[textValue(c["uid"])] = c
	}
	changes := []any{}
	targets := []map[string]any{}
	for _, v := range array(newDoc["combatants"]) {
		c := object(v)
		if c["type"] != "npc" {
			continue
		}
		previous := old[textValue(c["uid"])]
		c["impactHistory"] = array(previous["impactHistory"])
		if previous == nil {
			continue
		}
		name := "Существо"
		if id := int64(number(c["itemId"])); id > 0 {
			var err error
			name, _, _, err = applicationItem(ctx, tx, id)
			if err != nil {
				return err
			}
		}
		record, err := npcImpactDifference(ctx, tx, previous, c, npcApplicationTarget(encounterID, c, name), "Изменения в бою", 0)
		if err != nil {
			return err
		}
		if record == nil {
			continue
		}
		changes = append(changes, record)
		targets = append(targets, c)
	}
	if len(changes) == 0 {
		return nil
	}
	var id int64
	raw, _ := json.Marshal(map[string]any{"impacts": changes})
	err := tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility) SELECT id,owner_user_id,'damage_applied','Изменения в бою',CAST($2 AS jsonb),'public' FROM dndshare."session" WHERE id=$1 RETURNING id`, sessionID, json.RawMessage(raw)).Scan(&id)
	if err != nil {
		return err
	}
	for i, v := range changes {
		record := object(v)
		record["eventId"] = id
		appendNPCHistory(targets[i], record)
	}
	return nil
}
