package store

import (
	"encoding/json"
	"math"
)

type usableContainer struct {
	values map[string]any
	key    string
	origin string
}

func (doc transferDocument) usableContainers(source string) []usableContainer {
	values := doc.values()
	if source == "potions" || source == "weapon" {
		return []usableContainer{{values, source, source}}
	}
	if source != "items" {
		return nil
	}
	items := object(values["items"])
	containers := []usableContainer{{items, "equipped", "equipped"}}
	for _, raw := range array(items["sections"]) {
		containers = append(containers, usableContainer{object(raw), "items", "section:" + textValue(object(raw)["id"])})
	}
	return containers
}

// Reserve a single unit from its real server container, keeping the stack UID.
func (doc transferDocument) takeUsableUnit(source, uid string) (map[string]any, error) {
	for _, container := range doc.usableContainers(source) {
		entries := array(container.values[container.key])
		for i, raw := range entries {
			entry, ok := raw.(map[string]any)
			if !ok || entry["uid"] != uid {
				continue
			}
			if object(object(entry["params"])["magic"])["lost"] == true || object(object(entry["params"])["creation"])["expired"] == true {
				return nil, ErrItemTransferConflict
			}
			count := float64(1)
			if entry["count"] != nil {
				count, ok = entry["count"].(float64)
				if !ok || count < 1 || count > 999 || math.Trunc(count) != count {
					return nil, ErrItemTransferConflict
				}
			}
			unit := make(map[string]any, len(entry))
			for key, value := range entry {
				unit[key] = value
			}
			unit["count"] = float64(1)
			unit["_use_origin"] = container.origin
			if count == 1 {
				container.values[container.key] = append(entries[:i:i], entries[i+1:]...)
			} else {
				entry["count"] = count - 1
			}
			return unit, nil
		}
	}
	return nil, ErrItemTransferConflict
}

func usableStackIdentity(entry map[string]any) string {
	identity := make(map[string]any, len(entry))
	for key, value := range entry {
		if key != "count" && key != "_use_origin" {
			identity[key] = value
		}
	}
	raw, _ := json.Marshal(identity)
	return string(raw)
}

// Merge only into the unchanged original stack. A moved, edited, spent or
// separately reserved stack gets an independent return entry, never a duplicate UID.
func (doc transferDocument) returnUsableUnit(source string, unit map[string]any, uid string) {
	for _, container := range doc.usableContainers(source) {
		if container.origin != textValue(unit["_use_origin"]) {
			continue
		}
		for _, raw := range array(container.values[container.key]) {
			entry, ok := raw.(map[string]any)
			if !ok || usableStackIdentity(entry) != usableStackIdentity(unit) {
				continue
			}
			count, ok := entry["count"].(float64)
			if ok && count >= 1 && count < 999 && math.Trunc(count) == count {
				entry["count"] = count + 1
				return
			}
		}
	}
	delete(unit, "_use_origin")
	unit["uid"] = uid
	doc.receive(source, unit, false, uid)
}
